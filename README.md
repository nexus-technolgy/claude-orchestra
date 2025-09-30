# 🎭 Claude Agent Orchestra

<p align="center">
  <img src="docs/logo.png" alt="Claude Agent Orchestra" width="200"/>
</p>

<p align="center">
  <strong>Self-hosted autonomous Claude Code agents orchestrated via GitHub webhooks</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage">Usage</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## 🌟 Features

- **🤖 Autonomous Agents**: Spawn Claude Code agents automatically from GitHub issues and PRs
- **⚡ Real-time Webhooks**: Instant response to `@claude` mentions via GitHub webhooks
- **🖥️ Full Workspace**: Each agent gets its own isolated workspace with git, tmux, and full system access
- **👀 Observable**: Connect to any running agent session with tmux to monitor or interact
- **🔌 MCP Integration**: Chrome DevTools, filesystem, and GitHub access via Model Context Protocol
- **🔒 Production Ready**: SSL, rate limiting, signature verification, and comprehensive logging
- **📊 Monitoring**: Health checks and active agent tracking
- **🧪 Fully Tested**: Comprehensive test suite with Vitest

## 🚀 Quick Start

### Prerequisites

- Linux or macOS
- [Bun](https://bun.sh) >= 1.0
- [Claude Code](https://docs.claude.com/en/docs/claude-code)
- [GitHub CLI](https://cli.github.com/)
- tmux
- nginx (for production)
- A domain name (for SSL)

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/claude-agent-orchestra.git
cd claude-agent-orchestra

# Install dependencies
bun install

# Copy and configure environment
cp .env.example .env
nano .env  # Add your API keys and configuration

# Run tests
bun test

# Deploy
bun run deploy
```
### Configuration
Edit `.env` with your credentials:
```bash
# GitHub
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_TOKEN=ghp_your_token

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your_key

# Domain
DOMAIN=claude-agents.yourdomain.com
```
### GitHub Webhook Setup

1. Go to your repository → Settings → Webhooks → Add webhook
2. Payload URL: https://your-domain.com/webhook
3. Content type: application/json
4. Secret: (your GITHUB_WEBHOOK_SECRET)
5. Events:
   - Issue comments
   - Pull request review comments
   - Issues
   - Pull requests
6. Save!

## 📖 Usage
### Triggering Agents
Simply mention `@claude` in a GitHub issue or PR comment:
```markdown
@claude Please refactor the authentication module to use JWT tokens.
Add comprehensive tests and update the documentation.
```
The system will:

1. 🔔 Receive the webhook instantly
2. 🏗️ Create an isolated workspace
3. 🤖 Spawn a Claude Code agent in a tmux session
4. 📝 Post a status comment with connection details
5. 🚀 Start working autonomously

### Monitoring Agents
```bash
# List all active agents
tmux list-sessions | grep claude-

# Attach to an agent's session
tmux attach -t claude-issue-42

# View logs
tail -f ~/claude-workspaces/issue-42/claude.log

# Check system status
curl https://your-domain.com/health
```
### Management CLI
```bash
# Install management script
chmod +x scripts/claude-manager.sh
alias claude-manager='./scripts/claude-manager.sh'

# Commands
claude-manager list          # List active agents
claude-manager attach issue-42   # Attach to session
claude-manager logs issue-42     # View logs
claude-manager kill issue-42     # Kill specific agent
claude-manager status            # System status
```
### Interacting with Agents
When attached to a tmux session, you can:

- Type messages directly to the agent
- Provide additional context
- Answer questions
- Monitor progress in real-time

Press `Ctrl+B` then `D` to detach without stopping the agent.
## 🏗️ Architecture
```
┌─────────────────┐
│  GitHub Webhook │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Hono Server    │◄─── Rate Limiting
│  (Bun Runtime)  │◄─── Signature Verification
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Spawner   │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│  Workspace 1    │  │  Workspace 2    │
│  ├─ Git Repo    │  │  ├─ Git Repo    │
│  ├─ Claude Code │  │  ├─ Claude Code │
│  ├─ MCP Servers │  │  ├─ MCP Servers │
│  └─ Tmux Session│  │  └─ Tmux Session│
└─────────────────┘  └─────────────────┘
```
### Tech Stack

- Runtime: Bun - Fast, modern JavaScript runtime
- Framework: Hono - Ultrafast web framework
- Language: TypeScript - Type safety and great DX
- Testing: Vitest - Fast unit testing
- Process Management: systemd - Production service management
- Session Management: tmux - Multiple persistent terminal sessions
- Reverse Proxy: nginx - SSL termination and load balancing

## 🧪 Development
```bash
# Development mode with hot reload
bun run dev

# Run tests
bun test

# Run tests with UI
bun test:ui

# Coverage report
bun test:coverage

# Lint
bun run lint

# Format
bun run format
```
## 🤝 Contributing
We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (git checkout -b feature/amazing-feature)
3. Make your changes
4. Add tests for new functionality
5. Ensure tests pass (bun test)
6. Commit your changes (git commit -m 'Add amazing feature')
7. Push to the branch (git push origin feature/amazing-feature)
8. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow TypeScript best practices
- Update documentation
- Keep commits atomic and well-described
- Ensure CI passes before requesting review

## 📝 License
Apache 2.0 License - see LICENSE file for details

## 🙏 Acknowledgments

- Anthropic for Claude and Claude Code
- The open source community
- All contributors

## 📚 Resources

- Blog Post: Building Claude Agent Orchestra
- API Documentation
- Architecture Deep Dive
- Troubleshooting Guide

## 🔗 Links

Documentation
GitHub

<p align="center">Made with ❤️ by the Claude Agent Orchestra community</p>
