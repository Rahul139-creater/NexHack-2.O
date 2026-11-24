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
