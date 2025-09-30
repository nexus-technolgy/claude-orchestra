import { spawn } from 'child_process';
import logger from '../utils/logger';

export class TmuxManager {
  async createSession(name: string, workingDir: string): Promise<void> {
    return this.execute([
      'new-session',
      '-d',
      '-s',
      name,
      '-c',
      workingDir,
    ]);
  }

  async sendKeys(session: string, keys: string): Promise<void> {
    return this.execute(['send-keys', '-t', session, keys, 'C-m']);
  }

  async splitWindow(
    session: string,
    direction: 'h' | 'v',
    workingDir: string
  ): Promise<void> {
    return this.execute([
      'split-window',
      `-${direction}`,
      '-t',
      session,
      '-c',
      workingDir,
    ]);
  }

  async selectPane(session: string, pane: string): Promise<void> {
    return this.execute(['select-pane', '-t', `${session}:${pane}`]);
  }

  async sessionExists(name: string): Promise<boolean> {
    try {
      await this.execute(['has-session', '-t', name]);
      return true;
    } catch {
      return false;
    }
  }

  async killSession(name: string): Promise<void> {
    return this.execute(['kill-session', '-t', name]);
  }

  async listSessions(): Promise<string[]> {
    try {
      const output = await this.executeWithOutput(['list-sessions']);
      return output
        .split('\n')
        .filter((line) => line.includes('claude-'))
        .map((line) => line.split(':')[0]);
    } catch {
      return [];
    }
  }

  private execute(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('tmux', args);
      
      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          logger.error('Tmux command failed', { args, stderr });
          reject(new Error(`Tmux command failed: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        logger.error('Failed to spawn tmux', { error });
        reject(error);
      });
    });
  }

  private executeWithOutput(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('tmux', args);
      
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
          resolve(stdout);
        } else {
          reject(new Error(`Tmux command failed: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }
}

export default new TmuxManager();
