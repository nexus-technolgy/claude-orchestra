import { mkdir, writeFile, chmod } from 'fs/promises';
import { join } from 'path';
import config from '../config';
import logger from '../utils/logger';

export class WorkspaceManager {
  private baseDir: string;

  constructor() {
    this.baseDir = config.WORKSPACE_BASE;
  }

  async createWorkspace(type: string, number: number): Promise<string> {
    const workspacePath = join(this.baseDir, `${type}-${number}`);
    
    try {
      await mkdir(workspacePath, { recursive: true });
      logger.info('Created workspace', { path: workspacePath });
      return workspacePath;
    } catch (error) {
      logger.error('Failed to create workspace', { error, path: workspacePath });
      throw error;
    }
  }

  async createLaunchScript(
    workspacePath: string,
    type: string,
    number: number,
    instruction: string,
    repoFullName: string
  ): Promise<string> {
    const scriptPath = join(workspacePath, 'launch.sh');
    const logPath = join(workspacePath, 'claude.log');
    
    const script = `#!/bin/bash
set -e

cd "${workspacePath}"

# Clone or update repository
if [ ! -d ".git" ]; then
    echo "Cloning repository..."
    gh repo clone ${repoFullName} .
else
    echo "Updating repository..."
    git fetch --all
    git pull
fi

# Setup branch for this work
BRANCH_NAME="claude-${type}-${number}"
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

# Export environment
export ANTHROPIC_API_KEY="${config.ANTHROPIC_API_KEY}"
export CLAUDE_MCP_CONFIG="$HOME/mcp-config.json"

# Log setup
echo "Session started at $(date)" > "${logPath}"
echo "Type: ${type}" >> "${logPath}"
echo "Number: ${number}" >> "${logPath}"
echo "Instruction: ${instruction}" >> "${logPath}"
echo "---" >> "${logPath}"

# Launch Claude Code
echo "Starting Claude Code..."
claude-code "${instruction.replace(/"/g, '\\"')}" 2>&1 | tee -a "${logPath}"
`;

    await writeFile(scriptPath, script);
    await chmod(scriptPath, 0o755);
    
    logger.info('Created launch script', { path: scriptPath });
    return scriptPath;
  }

  getWorkspacePath(type: string, number: number): string {
    return join(this.baseDir, `${type}-${number}`);
  }

  getLogPath(type: string, number: number): string {
    return join(this.getWorkspacePath(type, number), 'claude.log');
  }
}

export default new WorkspaceManager();
