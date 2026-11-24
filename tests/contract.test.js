import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { Record } from '../server/src/models/Record.js';
import { Revision } from '../server/src/models/Revision.js';
import { Task } from '../server/src/models/Task.js';
import { Event } from '../server/src/models/Event.js';
import { hashToken } from '../server/src/utils/crypto.js';

const execFileAsync = promisify(execFile);

describe('Phase 4: Contract Test - MCP vs CLI Adapter', () => {
  let app;
  let server;
  let serverUrl;

  const aliceToken = 'token_alice_lead_contract';
  const mcpScriptPath = path.resolve(process.cwd(), 'adapters/mcp/src/index.js');
  const cliScriptPath = path.resolve(process.cwd(), 'adapters/cli/src/index.js');

  beforeAll(async () => {
    app = createApp();
    await new Promise(resolve => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        serverUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  beforeEach(async () => {
    await User.create({
      userId: 'alice',
      name: 'Alice Lead',
      role: 'lead',
      tokenHash: hashToken(aliceToken),
      tool: 'api'
    });

    await Record.create({
      recordId: 'DEC-001',
      type: 'decision',
      currentRevision: 1,
      readers: ['alice'],
      writers: ['alice']
    });

    await Revision.create({
      recordId: 'DEC-001',
      rev: 1,
      content: '# Decision: Architecture Specification\nUse standard client adapters.',
      author: 'alice',
      tool: 'api'
    });

    await Task.create([
      {
        taskId: 'TSK-001',
        title: 'Task for MCP execution',
        briefRef: { recordId: 'DEC-001', rev: 1 },
        status: 'open',
        fencingToken: 0,
        dependsOn: [{ recordId: 'DEC-001', rev: 1 }]
      },
      {
        taskId: 'TSK-002',
        title: 'Task for CLI execution',
        briefRef: { recordId: 'DEC-001', rev: 1 },
        status: 'open',
        fencingToken: 0,
        dependsOn: [{ recordId: 'DEC-001', rev: 1 }]
      }
    ]);
  });

  function normalize(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(normalize);
    }
    const clean = {};
    for (const [key, val] of Object.entries(obj)) {
      // Ignore tool label, timestamps, IDs, and dynamic keys
      if (
        [
          'tool',
          'createdAt',
          'updatedAt',
          'expiresAt',
          'timestamp',
          '_id',
          'idempotencyKey',
          'taskId',
          'title'
        ].includes(key)
      ) {
        continue;
      }
      clean[key] = normalize(val);
    }
    return clean;
  }

  it('runs identical scenario through MCP and CLI adapters with structural parity and correct audit tool labels', async () => {
    // -------------------------------------------------------------
    // SCENARIO 1: MCP Adapter (tool: claude-code)
    // -------------------------------------------------------------
    const mcpTransport = new StdioClientTransport({
      command: 'node',
      args: [mcpScriptPath],
      env: {
        ...process.env,
        KB_URL: serverUrl,
        KB_TOKEN: aliceToken,
        KB_TOOL: 'claude-code'
      }
    });

    const mcpClient = new Client(
      { name: 'test-mcp-client', version: '1.0.0' },
      { capabilities: {} }
    );
    await mcpClient.connect(mcpTransport);

    async function callMcp(name, args) {
      const res = await mcpClient.callTool({ name, arguments: args });
      return JSON.parse(res.content[0].text);
    }

    // 1. Read record
    const mcpRead = await callMcp('kb_read_record', { id: 'DEC-001' });

    // 2. Claim task
    const mcpClaim = await callMcp('kb_claim_task', { taskId: 'TSK-001' });

    // 3. Submit result
    const mcpSubmit = await callMcp('kb_submit_result', {
      taskId: 'TSK-001',
      attempt: 1,
      body: 'Standard result proposal content',
      citations: [{ recordId: 'DEC-001', rev: 1 }],
      fencingToken: mcpClaim.fencingToken,
      baseRevisions: [{ recordId: 'DEC-001', rev: 1 }]
    });

    // 4. Get task context
    const mcpContext = await callMcp('kb_get_task_context', { taskId: 'TSK-001' });

    // 5. Resume task
    const mcpResume = await callMcp('kb_resume_task', { taskId: 'TSK-001' });

    await mcpClient.close();

    // -------------------------------------------------------------
    // SCENARIO 2: CLI Adapter (tool: antigravity)
    // -------------------------------------------------------------
    async function runCli(args) {
      const { stdout } = await execFileAsync('node', [cliScriptPath, ...args], {
        env: {
          ...process.env,
          KB_URL: serverUrl,
          KB_TOKEN: aliceToken,
          KB_TOOL: 'antigravity'
        }
      });
      return JSON.parse(stdout);
    }

    // 1. Read record
    const cliRead = await runCli(['read', 'DEC-001']);

    // 2. Claim task
    const cliClaim = await runCli(['claim', 'TSK-002']);

    // 3. Submit result via file
    const tempFile = path.join(os.tmpdir(), `cli-result-${Date.now()}.json`);
    fs.writeFileSync(
      tempFile,
      JSON.stringify({
        attempt: 1,
        body: 'Standard result proposal content',
        citations: [{ recordId: 'DEC-001', rev: 1 }],
        fencingToken: cliClaim.fencingToken,
        baseRevisions: [{ recordId: 'DEC-001', rev: 1 }]
      })
    );

    let cliSubmit;
    try {
      cliSubmit = await runCli(['submit', 'TSK-002', '--file', tempFile]);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }

    // 4. Get task context
    const cliContext = await runCli(['context', 'TSK-002']);

    // 5. Resume task
    const cliResume = await runCli(['resume', 'TSK-002']);

    // -------------------------------------------------------------
    // ASSERT STRUCTURAL PARITY
    // -------------------------------------------------------------
    expect(normalize(mcpRead)).toEqual(normalize(cliRead));
    expect(normalize(mcpClaim)).toEqual(normalize(cliClaim));
    expect(normalize(mcpSubmit)).toEqual(normalize(cliSubmit));
    expect(normalize(mcpContext)).toEqual(normalize(cliContext));
    expect(normalize(mcpResume)).toEqual(normalize(cliResume));

    // -------------------------------------------------------------
    // ASSERT AUDIT EVENTS SHOW THE TWO DIFFERENT TOOL LABELS
    // -------------------------------------------------------------
    const mcpEvents = await Event.find({ taskId: 'TSK-001' });
    expect(mcpEvents.length).toBeGreaterThan(0);
    for (const ev of mcpEvents) {
      expect(ev.tool).toBe('claude-code');
    }

    const cliEvents = await Event.find({ taskId: 'TSK-002' });
    expect(cliEvents.length).toBeGreaterThan(0);
    for (const ev of cliEvents) {
      expect(ev.tool).toBe('antigravity');
    }
  });

  it('fresh-session test: brand new CLI process given only a taskId recovers task, latest draft, and cited sources', async () => {
    // TSK-001 was completed in previous or can be set up fresh
    await Task.create({
      taskId: 'TSK-003',
      title: 'Fresh session recovery task',
      briefRef: { recordId: 'DEC-001', rev: 1 },
      status: 'result_saved',
      owner: 'alice',
      fencingToken: 1,
      dependsOn: []
    });

    const { Result } = await import('../server/src/models/Result.js');
    await Result.create({
      taskId: 'TSK-003',
      attempt: 1,
      idempotencyKey: 'idemp_tsk_003',
      body: 'Draft specification for fresh session',
      citations: [{ recordId: 'DEC-001', rev: 1 }],
      createdBy: 'alice',
      tool: 'api',
      applied: false
    });

    // Spawn brand new CLI process with only taskId
    const { stdout } = await execFileAsync(
      'node',
      [cliScriptPath, 'context', 'TSK-003'],
      {
        env: {
          ...process.env,
          KB_URL: serverUrl,
          KB_TOKEN: aliceToken,
          KB_TOOL: 'fresh-agent'
        }
      }
    );

    const recovered = JSON.parse(stdout);

    expect(recovered.task.taskId).toBe('TSK-003');
    expect(recovered.task.status).toBe('result_saved');
    expect(recovered.latestResult.body).toBe('Draft specification for fresh session');
    expect(recovered.citedSources.length).toBe(1);
    expect(recovered.citedSources[0]).toEqual({
      recordId: 'DEC-001',
      rev: 1,
      content: '# Decision: Architecture Specification\nUse standard client adapters.'
    });
  });
});
