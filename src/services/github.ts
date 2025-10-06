import { spawn } from 'child_process';
import logger from '../utils/logger';

export type RepositoryPermission = 'admin' | 'write' | 'read' | 'none';

export interface PermissionCheckResult {
  permission: RepositoryPermission;
  role_name: string;
  isTrusted: boolean;
}

export class GitHubService {
  async checkUserPermission(
    repository: string,
    username: string
  ): Promise<PermissionCheckResult> {
    return new Promise((resolve, reject) => {
      const [owner, repo] = repository.split('/');
      const proc = spawn('gh', [
        'api',
        `/repos/${owner}/${repo}/collaborators/${username}/permission`,
      ]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const response = JSON.parse(stdout);
            const permission = response.permission as RepositoryPermission;
            const role_name = response.role_name || permission;

            // Trusted users: admin, write (includes maintain), or read (includes triage)
            // We exclude 'none' which means they have no explicit repository access
            const isTrusted = permission !== 'none';

            logger.info('Checked user permission', {
              repository,
              username,
              permission,
              role_name,
              isTrusted
            });

            resolve({ permission, role_name, isTrusted });
          } catch (error) {
            logger.error('Failed to parse permission response', { error, stdout });
            reject(new Error(`Failed to parse GitHub API response: ${error}`));
          }
        } else {
          logger.warn('Permission check failed', { stderr, repository, username });
          // If permission check fails (e.g., user not found), treat as untrusted
          resolve({ permission: 'none', role_name: 'none', isTrusted: false });
        }
      });

      proc.on('error', (error) => {
        logger.error('Failed to spawn gh CLI for permission check', { error });
        reject(error);
      });
    });
  }

  async postComment(
    repository: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('gh', [
        'issue',
        'comment',
        issueNumber.toString(),
        '--repo',
        repository,
        '--body',
        body,
      ]);

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info('Posted comment to GitHub', { repository, issueNumber });
          resolve();
        } else {
          logger.error('Failed to post comment', { stderr, repository, issueNumber });
          reject(new Error(`GitHub CLI failed: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        logger.error('Failed to spawn gh CLI', { error });
        reject(error);
      });
    });
  }

  async addPendingReviewLabel(
    repository: string,
    issueNumber: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const proc = spawn('gh', [
        'issue',
        'edit',
        issueNumber.toString(),
        '--repo',
        repository,
        '--add-label',
        'claude-pending-review',
      ]);

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info('Added pending review label', { repository, issueNumber });
          resolve();
        } else {
          logger.error('Failed to add label', { stderr, repository, issueNumber });
          // Don't reject - labeling is not critical
          resolve();
        }
      });

      proc.on('error', (error) => {
        logger.error('Failed to spawn gh CLI for labeling', { error });
        // Don't reject - labeling is not critical
        resolve();
      });
    });
  }

  extractClaudeMention(body: string): string | null {
    if (!body.toLowerCase().includes('@claude')) {
      return null;
    }

    const lines = body.split('\n');
    const instructionLines: string[] = [];
    let capture = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('@claude')) {
        capture = true;
        // Get text after @claude on same line
        const parts = line.split(/@claude/i);
        if (parts[1]) {
          const afterMention = parts[1].trim();
          if (afterMention) {
            instructionLines.push(afterMention);
          }
        }
      } else if (capture) {
        instructionLines.push(line);
      }
    }

    return instructionLines.length > 0 ? instructionLines.join('\n').trim() : null;
  }

  isApprovalCommand(body: string): boolean {
    const claudePattern = /@claude\s+approve/i;
    return claudePattern.test(body);
  }

  async removePendingReviewLabel(
    repository: string,
    issueNumber: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const proc = spawn('gh', [
        'issue',
        'edit',
        issueNumber.toString(),
        '--repo',
        repository,
        '--remove-label',
        'claude-pending-review',
      ]);

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info('Removed pending review label', { repository, issueNumber });
          resolve();
        } else {
          logger.error('Failed to remove label', { stderr, repository, issueNumber });
          // Don't reject - labeling is not critical
          resolve();
        }
      });

      proc.on('error', (error) => {
        logger.error('Failed to spawn gh CLI for label removal', { error });
        // Don't reject - labeling is not critical
        resolve();
      });
    });
  }

  async getOriginalIssueBody(
    repository: string,
    issueNumber: number
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const proc = spawn('gh', [
        'issue',
        'view',
        issueNumber.toString(),
        '--repo',
        repository,
        '--json',
        'body',
      ]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const response = JSON.parse(stdout);
            resolve(response.body || null);
          } catch (error) {
            logger.error('Failed to parse issue body', { error, stdout });
            reject(new Error(`Failed to parse GitHub API response: ${error}`));
          }
        } else {
          logger.error('Failed to get issue body', { stderr, repository, issueNumber });
          reject(new Error(`GitHub CLI failed: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        logger.error('Failed to spawn gh CLI for issue view', { error });
        reject(error);
      });
    });
  }
}

export default new GitHubService();
