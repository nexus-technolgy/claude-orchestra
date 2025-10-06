import { Hono } from 'hono';
import { verifyGitHubSignature } from '../utils/signature';
import type { GitHubWebhookPayload, ClaudeInstruction } from '../models/github';
import claudeService from '../services/claude';
import githubService from '../services/github';
import logger from '../utils/logger';

const webhook = new Hono();

webhook.post('/', async (c) => {
  try {
    // Get raw body for signature verification
    const rawBody = await c.req.text();
    const signature = c.req.header('x-hub-signature-256');

    // Verify signature
    const isValid = await verifyGitHubSignature(rawBody, signature);
    if (!isValid) {
      logger.warn('Invalid webhook signature');
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // Parse payload
    const payload: GitHubWebhookPayload = JSON.parse(rawBody);
    const eventType = c.req.header('x-github-event');

    logger.info('Received webhook', { eventType, action: payload.action });

    // Check if this is an approval command
    if (payload.comment?.body && githubService.isApprovalCommand(payload.comment.body)) {
      const result = await handleApprovalCommand(eventType, payload);
      return c.json(result);
    }

    // Extract Claude instruction
    const instruction = await extractInstruction(eventType, payload);

    if (instruction) {
      // Check sender permissions
      try {
        const permissionCheck = await githubService.checkUserPermission(
          instruction.repository,
          instruction.sender
        );

        if (!permissionCheck.isTrusted) {
          // Unknown/untrusted sender - request manual review
          logger.info('Request from untrusted sender requires review', {
            sender: instruction.sender,
            repository: instruction.repository,
            permission: permissionCheck.permission,
          });

          // Post comment and add label
          await Promise.all([
            githubService.postComment(
              instruction.repository,
              instruction.number,
              `@${instruction.sender} This request requires manual review because you don't have repository access.\n\n` +
              `A maintainer with repository access can approve this by commenting:\n` +
              `\`@claude approve\`\n\n` +
              `**Security Notice:** This measure prevents consumption attacks and malicious prompt injection.`
            ),
            githubService.addPendingReviewLabel(
              instruction.repository,
              instruction.number
            ),
          ]);

          return c.json({
            status: 'pending_review',
            type: instruction.type,
            number: instruction.number,
            sender: instruction.sender,
            permission: permissionCheck.permission,
          });
        }

        logger.info('Spawning agent for trusted sender', {
          sender: instruction.sender,
          repository: instruction.repository,
          permission: permissionCheck.permission,
          role: permissionCheck.role_name,
        });

        // Spawn agent asynchronously
        claudeService.spawnAgent(instruction).catch((error) => {
          logger.error('Failed to spawn agent', { error, instruction });
        });

        return c.json({
          status: 'agent_spawned',
          type: instruction.type,
          number: instruction.number,
          sender: instruction.sender,
          permission: permissionCheck.permission,
        });
      } catch (error) {
        logger.error('Permission check failed', { error, instruction });
        // On error, fail safe: don't spawn agent
        return c.json({
          status: 'error',
          error: 'Failed to verify user permissions',
        }, 500);
      }
    }

    return c.json({ status: 'ignored' });
  } catch (error) {
    logger.error('Webhook handler error', { error });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

async function handleApprovalCommand(
  eventType: string | undefined,
  payload: GitHubWebhookPayload
) {
  // Only process approval commands from comments
  if (eventType !== 'issue_comment' && eventType !== 'pull_request_review_comment') {
    return { status: 'ignored' };
  }

  const number = payload.issue?.number || payload.pull_request?.number;
  const type: 'issue' | 'pr' = payload.issue ? 'issue' : 'pr';
  const approver = payload.sender.login;
  const repository = payload.repository.full_name;

  if (!number) {
    return { status: 'ignored' };
  }

  try {
    // Check if approver has permissions
    const approverPermission = await githubService.checkUserPermission(
      repository,
      approver
    );

    if (!approverPermission.isTrusted) {
      logger.warn('Approval attempt by untrusted user', {
        approver,
        repository,
        number,
        permission: approverPermission.permission,
      });

      await githubService.postComment(
        repository,
        number,
        `@${approver} You don't have permission to approve this request. ` +
        `Only users with repository access can approve.`
      );

      return {
        status: 'approval_denied',
        approver,
        permission: approverPermission.permission,
      };
    }

    // Get original issue/PR body to extract instruction
    const originalBody = await githubService.getOriginalIssueBody(repository, number);

    if (!originalBody) {
      logger.warn('Could not retrieve original issue body for approval', {
        repository,
        number,
      });

      return { status: 'error', error: 'Could not retrieve original request' };
    }

    const instruction = githubService.extractClaudeMention(originalBody);

    if (!instruction) {
      logger.warn('No Claude instruction found in original issue', {
        repository,
        number,
      });

      await githubService.postComment(
        repository,
        number,
        `No @claude instruction found in the original ${type}.`
      );

      return { status: 'no_instruction' };
    }

    // Extract original sender from issue/PR
    const originalSender = type === 'issue'
      ? payload.issue?.user.login
      : payload.pull_request?.user.login;

    if (!originalSender) {
      return { status: 'error', error: 'Could not determine original sender' };
    }

    const claudeInstruction: ClaudeInstruction = {
      type,
      number,
      instruction,
      repository,
      sender: originalSender,
      cloneUrl: payload.repository.clone_url,
    };

    logger.info('Approval granted by trusted user', {
      approver,
      originalSender,
      repository,
      number,
      approverPermission: approverPermission.permission,
    });

    // Remove pending review label and spawn agent
    await Promise.all([
      githubService.removePendingReviewLabel(repository, number),
      githubService.postComment(
        repository,
        number,
        `✅ Approved by @${approver} - spawning Claude agent...`
      ),
    ]);

    claudeService.spawnAgent(claudeInstruction).catch((error) => {
      logger.error('Failed to spawn agent after approval', { error, claudeInstruction });
    });

    return {
      status: 'approved_and_spawned',
      type,
      number,
      approver,
      originalSender,
      approverPermission: approverPermission.permission,
    };
  } catch (error) {
    logger.error('Approval command handler error', { error, repository, number });
    return {
      status: 'error',
      error: 'Failed to process approval',
    };
  }
}

async function extractInstruction(
  eventType: string | undefined,
  payload: GitHubWebhookPayload
): Promise<ClaudeInstruction | null> {
  let body: string | undefined;
  let number: number | undefined;
  let type: 'issue' | 'pr' | undefined;

  // Handle different event types
  if (eventType === 'issue_comment' && payload.action === 'created') {
    body = payload.comment?.body;
    number = payload.issue?.number;
    type = 'issue';
  } else if (
    eventType === 'pull_request_review_comment' &&
    payload.action === 'created'
  ) {
    body = payload.comment?.body;
    number = payload.pull_request?.number;
    type = 'pr';
  } else if (eventType === 'issues' && payload.action === 'opened') {
    body = payload.issue?.body;
    number = payload.issue?.number;
    type = 'issue';
  } else if (eventType === 'pull_request' && payload.action === 'opened') {
    body = payload.pull_request?.body;
    number = payload.pull_request?.number;
    type = 'pr';
  }

  if (!body || !number || !type) {
    return null;
  }

  // Extract @claude mention
  const instruction = githubService.extractClaudeMention(body);

  if (!instruction) {
    return null;
  }

  return {
    type,
    number,
    instruction,
    repository: payload.repository.full_name,
    sender: payload.sender.login,
    cloneUrl: payload.repository.clone_url,
  };
}

export default webhook;
