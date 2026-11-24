# Team KB Harness

Multi-Agent Harness for a Shared Team Knowledge Base (NexHack 2.0 - Problem Statement 01).

A shared knowledge base (briefs, decisions, documents, tasks, results) that multiple AI agent tools use through identical operations: read a record, claim a task, submit a result. Work can be handed from one tool to another without copying chat history.

## Monorepo Layout
- `/server`: Express + Mongoose + Zod API server with per-record ACL, optimistic concurrency, and audit logging.
- `/packages/kb-client`: Shared isomorphic JavaScript client library for accessing the KB.
- `/adapters/mcp`: Model Context Protocol (MCP) stdio adapter exposing KB tools.
- `/adapters/cli`: Command-line tool adapter for running agent tasks.
- `/client`: React + Vite frontend dashboard.
- `/scripts`: Utility scripts (seeding, kill-resume demo, deterministic multi-agent handover demo).
- `/tests`: Vitest + Supertest integration tests using `mongodb-memory-server`.

## Tech Stack
- Node.js 20+ (ES modules)
- Express, Mongoose, Zod
- Vitest, Supertest, mongodb-memory-server
- React, Vite
- @modelcontextprotocol/sdk

## Connect your agent tools

### 1. Claude Code MCP Configuration
Add the following configuration to your `claude_desktop_config.json` or `.claude/config.json`:

```json
{
  "mcpServers": {
    "team-kb": {
      "command": "node",
      "args": ["<ABSOLUTE_PATH_TO_NEXHACK_KB>/adapters/mcp/src/index.js"],
      "env": {
        "KB_URL": "<KB_URL>",
        "KB_TOKEN": "<KB_TOKEN>",
        "KB_TOOL": "claude-code"
      }
    }
  }
}
```

### 2. Antigravity MCP Configuration
Add the following configuration to your Antigravity agent settings or global `mcp_settings.json`:

```json
{
  "mcpServers": {
    "team-kb": {
      "command": "node",
      "args": ["<ABSOLUTE_PATH_TO_NEXHACK_KB>/adapters/mcp/src/index.js"],
      "env": {
        "KB_URL": "<KB_URL>",
        "KB_TOKEN": "<KB_TOKEN>",
        "KB_TOOL": "antigravity"
      }
    }
  }
}
```

### 3. Command Line Interface (CLI) Usage
Set the environment variables and run commands:

```bash
export KB_URL="http://localhost:3000"
export KB_TOKEN="<YOUR_DEV_TOKEN>"
export KB_TOOL="cli-agent"

# Read the latest record revision
node adapters/cli/src/index.js read DEC-001

# Read a specific historical revision
node adapters/cli/src/index.js read DEC-001 --rev 1

# Claim an open or stale task
node adapters/cli/src/index.js claim TSK-001

# Submit result with citations, fencing token, and base revisions
cat <<EOF > result.json
{
  "attempt": 1,
  "body": "Implementation plan and draft code",
  "citations": [{ "recordId": "DEC-001", "rev": 1 }],
  "fencingToken": 1,
  "baseRevisions": [{ "recordId": "DEC-001", "rev": 1 }]
}
EOF
node adapters/cli/src/index.js submit TSK-001 --file result.json

# Fetch complete task execution context (task definition, latest draft, historical cited sources)
node adapters/cli/src/index.js context TSK-001

# Resume / complete a task whose result is saved
node adapters/cli/src/index.js resume TSK-001
```

