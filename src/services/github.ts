import { spawn } from 'child_process';
import logger from '../utils/logger';

export class GitHubService {
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
}

export default new GitHubService();
