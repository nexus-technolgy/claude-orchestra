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

    // Extract Claude instruction
    const instruction = await extractInstruction(eventType, payload);

    if (instruction) {
      // Spawn agent asynchronously
      claudeService.spawnAgent(instruction).catch((error) => {
        logger.error('Failed to spawn agent', { error, instruction });
      });

      return c.json({
        status: 'agent_spawned',
        type: instruction.type,
        number: instruction.number,
      });
    }

    return c.json({ status: 'ignored' });
  } catch (error) {
    logger.error('Webhook handler error', { error });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

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
