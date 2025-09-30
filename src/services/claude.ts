import type { ClaudeInstruction } from '../models/github';
import workspaceManager from './workspace';
import tmux from './tmux';
import logger from '../utils/logger';
import githubService from './github';

export class ClaudeAgentService {
  async spawnAgent(instruction: ClaudeInstruction): Promise<string> {
    const { type, number, instruction: task, repository, sender } = instruction;
    const sessionName = `claude-${type}-${number}`;

    try {
      // Check if session already exists
      if (await tmux.sessionExists(sessionName)) {
        logger.warn('Session already exists', { sessionName });
        throw new Error(`Agent already running for ${type} ${number}`);
      }

      // Create workspace
      const workspacePath = await workspaceManager.createWorkspace(type, number);
      
      // Create launch script
      const scriptPath = await workspaceManager.createLaunchScript(
        workspacePath,
        type,
        number,
        task,
        repository
      );

      // Create tmux session
      await this.setupTmuxSession(sessionName, workspacePath, scriptPath);

      // Post status to GitHub
      await this.postStatusToGitHub(type, number, repository, sessionName, workspacePath, sender);

      logger.info('Successfully spawned Claude agent', {
        sessionName,
        workspace: workspacePath,
        type,
        number,
      });

      return sessionName;
    } catch (error) {
      logger.error('Failed to spawn Claude agent', { error, type, number });
      throw error;
    }
  }

  private async setupTmuxSession(
    sessionName: string,
    workspacePath: string,
    scriptPath: string
  ): Promise<void> {
    // Create main session
    await tmux.createSession(sessionName, workspacePath);
    await tmux.sendKeys(sessionName, `bash ${scriptPath}`);

    // Split window for git monitoring
    await tmux.splitWindow(sessionName, 'h', workspacePath);
    await tmux.sendKeys(
      sessionName,
      'watch -n 5 "git status --short && echo && git log --oneline -5"'
    );

    // Split for logs
    await tmux.splitWindow(`${sessionName}:0.1`, 'v', workspacePath);
    await tmux.sendKeys(
      sessionName,
      `tail -f ${workspacePath}/claude.log`
    );

    // Focus on main pane
    await tmux.selectPane(sessionName, '0.0');
  }

  private async postStatusToGitHub(
    type: string,
    number: number,
    repository: string,
    sessionName: string,
    workspacePath: string,
    sender: string
  ): Promise<void> {
    const comment = `🤖 **Claude Code Agent Activated**

**Workspace:** \`${workspacePath}\`
**Session:** \`${sessionName}\`
**Branch:** \`claude-${type}-${number}\`

Connect with: \`tmux attach -t ${sessionName}\`

Requested by: @${sender}

---
*Agent is now working on your request. You can monitor progress by attaching to the tmux session.*`;

    await githubService.postComment(repository, number, comment);
  }

  async killAgent(type: string, number: number): Promise<void> {
    const sessionName = `claude-${type}-${number}`;
    
    try {
      await tmux.killSession(sessionName);
      logger.info('Killed Claude agent', { sessionName });
    } catch (error) {
      logger.error('Failed to kill agent', { error, sessionName });
      throw error;
    }
  }

  async listAgents(): Promise<string[]> {
    return tmux.listSessions();
  }
}

export default new ClaudeAgentService();
