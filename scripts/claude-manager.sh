#!/bin/bash

case "$1" in
    list)
        echo "Active Claude sessions:"
        tmux list-sessions 2>/dev/null | grep claude- || echo "No active sessions"
        ;;
    
    attach)
        if [ -z "$2" ]; then
            echo "Usage: $0 attach <issue|pr>-<number>"
            exit 1
        fi
        tmux attach -t "claude-$2"
        ;;
    
    logs)
        if [ -z "$2" ]; then
            echo "Usage: $0 logs <issue|pr>-<number>"
            exit 1
        fi
        tail -f ~/claude-workspaces/"$2"/claude.log
        ;;
    
    kill)
        if [ -z "$2" ]; then
            echo "Usage: $0 kill <issue|pr>-<number>"
            exit 1
        fi
        tmux kill-session -t "claude-$2"
        ;;
    
    killall)
        tmux list-sessions 2>/dev/null | grep claude- | cut -d: -f1 | xargs -I {} tmux kill-session -t {}
        echo "All Claude sessions terminated"
        ;;
    
    status)
        echo "=== Webhook Server Status ==="
        systemctl status claude-webhook --no-pager
        
        echo -e "\n=== Active Sessions ==="
        tmux list-sessions 2>/dev/null | grep claude- || echo "None"
        
        echo -e "\n=== Workspaces ==="
        ls -lh ~/claude-workspaces/ 2>/dev/null || echo "No workspaces"
        ;;
    
    *)
        echo "Claude Manager"
        echo "Usage: $0 {list|attach|logs|kill|killall|status} [args]"
        echo ""
        echo "Commands:"
        echo "  list              - List all active Claude sessions"
        echo "  attach <id>       - Attach to a Claude session"
        echo "  logs <id>         - Tail logs for a session"
        echo "  kill <id>         - Kill a specific session"
        echo "  killall           - Kill all Claude sessions"
        echo "  status            - Show system status"
        ;;
esac
