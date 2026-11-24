#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { KBClient, KBError } from '@team-kb/client';

const baseUrl = process.env.KB_URL || 'http://127.0.0.1:3000';
const token = process.env.KB_TOKEN || '';
const tool = process.env.KB_TOOL || 'mcp';

const client = new KBClient({ baseUrl, token, tool });

const server = new McpServer({
  name: 'team-kb-mcp',
  version: '1.0.0'
});

function formatSuccess(data) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

function formatError(err) {
  console.error('[MCP Tool Error]:', err.message);
  const code = err.code || (err instanceof KBError ? 'KB_ERROR' : 'MCP_ERROR');
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: err.message, code })
      }
    ]
  };
}

// 1. kb_read_record
server.tool(
  'kb_read_record',
  'Read a record or specific historical revision from the shared team knowledge base.',
  {
    id: z.string().describe('Record ID (e.g., BRF-001, DEC-001, DOC-001)'),
    rev: z.number().int().optional().describe('Historical revision number (optional, defaults to latest)')
  },
  async ({ id, rev }) => {
    try {
      const record = await client.readRecord(id, rev);
      return formatSuccess(record);
    } catch (err) {
      return formatError(err);
    }
  }
);

// 2. kb_claim_task
server.tool(
  'kb_claim_task',
  'Claim an open or stale task in the shared knowledge base to acquire an exclusive lease and fencing token.',
  {
    taskId: z.string().describe('Task ID (e.g., TSK-001)')
  },
  async ({ taskId }) => {
    try {
      const res = await client.claimTask(taskId);
      return formatSuccess(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

// 3. kb_submit_result
server.tool(
  'kb_submit_result',
  'Submit execution output or plan for a claimed task with citations, fencing token, and base revisions.',
  {
    taskId: z.string().describe('Task ID (e.g., TSK-001)'),
    attempt: z.number().int().default(1).describe('Attempt number for idempotency'),
    body: z.union([z.string(), z.record(z.any())]).describe('Result markdown, text, or structured JSON'),
    citations: z
      .array(
        z.object({
          recordId: z.string(),
          rev: z.number().int()
        })
      )
      .optional()
      .default([])
      .describe('Array of cited records with their revision numbers'),
    fencingToken: z.number().int().describe('Fencing token acquired when claiming the task'),
    baseRevisions: z
      .union([
        z.array(z.object({ recordId: z.string(), rev: z.number().int() })),
        z.record(z.number().int())
      ])
      .optional()
      .describe('Base revisions of records used during execution')
  },
  async ({ taskId, attempt, body, citations, fencingToken, baseRevisions }) => {
    try {
      const res = await client.submitResult(taskId, {
        attempt,
        body,
        citations,
        fencingToken,
        baseRevisions
      });
      return formatSuccess(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

// 4. kb_get_task_context
server.tool(
  'kb_get_task_context',
  'Fetch the complete execution context for a task, including the task definition, latest result, and cited sources resolved at exact historical revisions.',
  {
    taskId: z.string().describe('Task ID (e.g., TSK-001)')
  },
  async ({ taskId }) => {
    try {
      const context = await client.getTaskContext(taskId);
      return formatSuccess(context);
    } catch (err) {
      return formatError(err);
    }
  }
);

// 5. kb_resume_task
server.tool(
  'kb_resume_task',
  'Complete and apply a task whose result has been saved in the shared knowledge base.',
  {
    taskId: z.string().describe('Task ID (e.g., TSK-001)')
  },
  async ({ taskId }) => {
    try {
      const res = await client.resumeTask(taskId);
      return formatSuccess(res);
    } catch (err) {
      return formatError(err);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP Server] Team KB MCP server running on stdio');
}

main().catch(err => {
  console.error('[MCP Server Fatal Error]:', err);
  process.exit(1);
});
