#!/bin/bash
set -e

echo "🚀 Deploying Claude Agent Orchestra"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

source .env

echo -e "${YELLOW}📋 Checking dependencies...${NC}"

# Check required commands
REQUIRED_COMMANDS=("bun" "tmux" "gh" "nginx" "systemctl")
for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}❌ $cmd is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} $cmd"
done

# Install bun dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
bun install

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
bun test

# Create workspace directory
echo -e "${YELLOW}📁 Creating workspace directory...${NC}"
mkdir -p $WORKSPACE_BASE
echo -e "${GREEN}✓${NC} Created $WORKSPACE_BASE"

# Setup MCP config
echo -e "${YELLOW}⚙️ Setting up MCP configuration...${NC}"
cat > ~/mcp-config.json << EOF
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "$WORKSPACE_BASE"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "$GITHUB_TOKEN"
      }
    }
  }
}
EOF
echo -e "${GREEN}✓${NC} MCP config created"

# Create systemd service
echo -e "${YELLOW}🔧 Creating systemd service...${NC}"
sudo tee /etc/systemd/system/claude-webhook.service > /dev/null << EOF
[Unit]
Description=Claude Agent Orchestra Webhook Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
EnvironmentFile=$(pwd)/.env
ExecStart=$(which bun) run src/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload
sudo systemctl enable claude-webhook
sudo systemctl restart claude-webhook

echo -e "${GREEN}✓${NC} Service created and started"

# Setup SSL if domain is configured
if [ ! -z "$DOMAIN" ]; then
    echo -e "${YELLOW}🔐 Setting up SSL...${NC}"
    sudo bash scripts/setup-ssl.sh
else
    echo -e "${YELLOW}⚠️ No DOMAIN configured, skipping SSL setup${NC}"
fi

# Check service status
sleep 2
if systemctl is-active --quiet claude-webhook; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "Service status:"
    sudo systemctl status claude-webhook --no-pager
    echo ""
    echo "Webhook URL: https://$DOMAIN/webhook"
    echo "Health check: https://$DOMAIN/health"
else
    echo -e "${RED}❌ Service failed to start${NC}"
    sudo journalctl -u claude-webhook -n 50 --no-pager
    exit 1
fi
