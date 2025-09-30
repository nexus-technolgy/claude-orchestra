# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Agent Orchestra is a self-hosted system that spawns autonomous Claude Code agents in isolated tmux sessions when GitHub issues or PRs mention `@claude`. Each agent gets its own workspace with git, full system access, and MCP (Model Context Protocol) integration.

## Tech Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Framework**: Hono (ultrafast web framework)
- **Language**: TypeScript with strict mode
- **Testing**: Vitest
- **Process Management**: systemd (production) + tmux (agent sessions)
- **Reverse Proxy**: nginx (SSL termination)

## Project Structure

```
/src
  /models       - TypeScript interfaces (use type-only imports)
  /routes       - Hono route handlers (webhook, health)
  /services     - Business logic (claude, github, tmux, workspace)
  /utils        - Utilities (logger, signature verification)
  config.ts     - Environment config with Zod validation
  index.ts      - Server entrypoint
/scripts        - Shell scripts (deploy, claude-manager, setup-ssl)
/tests          - Vitest test files
```

## Development Commands

```bash
# Development with hot reload
bun run dev

# Run tests
bun test

# Run tests with UI
bun test:ui

# Coverage report
bun test:coverage

# Start production server
bun start

# Build for production
bun run build

# Deploy to production (Linux only)
bun run deploy
```

## Architecture Flow

1. GitHub webhook receives event → nginx reverse proxy
2. Hono server validates signature & rate limits
3. Extract `@claude` mention from issue/PR/comment
4. Create isolated workspace in `~/claude-workspaces/{type}-{number}`
5. Generate launch script with git clone, branch setup, env vars
6. Spawn tmux session with 3 panes:
   - Pane 0: Claude Code agent running
   - Pane 1: Git status monitoring (watch command)
   - Pane 2: Live log tailing
7. Post GitHub comment with connection details
8. Agent works autonomously, commits to branch `claude-{type}-{number}`

## Key Implementation Details

### TypeScript Imports
- Use `import type` for interfaces due to `verbatimModuleSyntax`
- Models are in `/src/models` (not `/src/types`)

### Webhook Processing
- Validates GitHub signature (HMAC SHA-256)
- Supports: `issue_comment`, `pull_request_review_comment`, `issues`, `pull_requests`
- Extracts `@claude` mentions case-insensitively
- Spawns agents asynchronously to avoid blocking webhook response

### Workspace Management
- Each workspace is isolated: `~/claude-workspaces/{issue|pr}-{number}`
- Contains: cloned repo, launch script, logs
- Automatic branch creation: `claude-{type}-{number}`

### Tmux Sessions
- Named: `claude-{type}-{number}`
- Split into 3 panes for monitoring
- Can attach with: `tmux attach -t claude-issue-42`

### Environment Configuration
- All config validated with Zod schemas
- Required vars: `GITHUB_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`
- Optional: `DOMAIN`, `PORT`, `WORKSPACE_BASE`, rate limiting, log level

## Management Commands

Use `scripts/claude-manager.sh`:

```bash
./scripts/claude-manager.sh list          # List active agents
./scripts/claude-manager.sh attach issue-42   # Attach to session
./scripts/claude-manager.sh logs issue-42     # View logs
./scripts/claude-manager.sh kill issue-42     # Kill specific agent
./scripts/claude-manager.sh killall           # Kill all agents
./scripts/claude-manager.sh status            # System status
```

## Testing

- Tests use Vitest with Node environment
- Mock GitHub webhooks with proper HMAC signatures
- Test signature verification, Claude mention extraction, webhook routes

## Production Deployment

1. Install prerequisites: Bun, tmux, gh CLI, nginx, systemd
2. Configure `.env` from `.env.example`
3. Run `bun run deploy` (sets up systemd service, SSL, MCP config)
4. Configure GitHub webhook pointing to `https://your-domain.com/webhook`

## MCP Configuration

Generated at `~/mcp-config.json` with servers:
- `puppeteer`: Chrome DevTools automation
- `filesystem`: Workspace file access
- `github`: Repository operations

## Security

- GitHub webhook signature verification (required)
- Rate limiting on webhook endpoint
- SSL/TLS via nginx + Let's Encrypt
- Systemd service runs as non-root user

## Common Patterns

### Adding New Route
1. Create handler in `/src/routes/{name}.ts`
2. Export Hono app instance
3. Mount in `/src/index.ts` with `app.route('/{path}', handler)`

### Adding New Service
1. Create class in `/src/services/{name}.ts`
2. Export singleton instance: `export default new MyService()`
3. Import and use in routes/other services

### Adding Environment Variable
1. Add to Zod schema in `/src/config.ts`
2. Add to `.env.example` with example value
3. Update deployment scripts if needed