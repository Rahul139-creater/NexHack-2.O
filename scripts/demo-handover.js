import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createApp } from '../server/src/app.js';
import { seedDatabase, SEED_USERS } from './seed.js';
import { Task } from '../server/src/models/Task.js';
import { Result } from '../server/src/models/Result.js';
import { Event } from '../server/src/models/Event.js';
import { ReviewFlag } from '../server/src/models/ReviewFlag.js';

const execFileAsync = promisify(execFile);

function printHeader(title) {
  console.log('\n' + '='.repeat(78));
  console.log(` ${title}`);
  console.log('='.repeat(78));
}

function printStep(num, name) {
  console.log(`\n>>> [STEP ${num}] ${name}`);
  console.log('-'.repeat(50));
}

async function runDemo() {
  printHeader('NEXHACK 2.0: MULTI-AGENT KB HARNESS - DETERMINISTIC DEMO');

  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  const { connectDB } = await import('../server/src/db.js');
  await connectDB(uri);
  await seedDatabase(uri);

  const app = createApp();
  let server;
  const port = await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const alice = SEED_USERS.find((u) => u.userId === 'alice');
  const bob = SEED_USERS.find((u) => u.userId === 'bob');
  const carol = SEED_USERS.find((u) => u.userId === 'carol');

  const mcpScriptPath = path.resolve(process.cwd(), 'adapters/mcp/src/index.js');
  const cliScriptPath = path.resolve(process.cwd(), 'adapters/cli/src/index.js');

  const evidenceTable = [];

  // =========================================================================
  // STEP 1: Permission Denial
  // =========================================================================
  printStep(1, 'Permission Denial (RBAC / per-record ACL enforcement)');
  // Bob (dev) tries to update BRF-001 (writers: ['alice'])
  const permRes = await fetch(`${baseUrl}/api/records/BRF-001`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${bob.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: 'Unauthorized update attempt by Bob',
      baseRevision: 1
    })
  });
  const permBody = await permRes.json();
  console.log(`Bob attempted PUT /api/records/BRF-001 -> Status: ${permRes.status}, Code: ${permBody.code}`);
  console.log(`Server Error Response: "${permBody.error}"`);

  if (permRes.status !== 403 || permBody.code !== 'FORBIDDEN') {
    throw new Error(`Step 1 Failed: Expected 403 FORBIDDEN, got ${permRes.status}`);
  }
  console.log('PASS ✓: Unauthorized write rejected with 403 FORBIDDEN.');
  evidenceTable.push({
    step: 1,
    actor: 'bob',
    tool: 'api',
    action: 'update_record',
    revision: 'BRF-001@1',
    outcome: '403 FORBIDDEN (Blocked)'
  });

  // =========================================================================
  // STEP 2: Tool A (MCP / claude-code) claims task & submits plan
  // =========================================================================
  printStep(2, 'Tool A (MCP Adapter: claude-code) Claims Task & Submits Plan');
  const mcpTransport = new StdioClientTransport({
    command: 'node',
    args: [mcpScriptPath],
    env: {
      ...process.env,
      KB_URL: baseUrl,
      KB_TOKEN: alice.token,
      KB_TOOL: 'claude-code'
    }
  });
  const mcpClient = new Client({ name: 'mcp-demo', version: '1.0.0' }, { capabilities: {} });
  await mcpClient.connect(mcpTransport);

  // Read DEC-001
  const readRes = await mcpClient.callTool({
    name: 'kb_read_record',
    arguments: { id: 'DEC-001' }
  });
  const dec1 = JSON.parse(readRes.content[0].text);
  console.log(`Tool A read source: ${dec1.recordId} rev ${dec1.currentRevision}`);

  // Claim TSK-001
  const claimRes = await mcpClient.callTool({
    name: 'kb_claim_task',
    arguments: { taskId: 'TSK-001' }
  });
  const claimData = JSON.parse(claimRes.content[0].text);
  console.log(`Tool A claimed TSK-001 -> status: ${claimData.task.status}, fencingToken: ${claimData.fencingToken}`);

  // Submit result with citation DEC-001@1
  const planBody = 'Architecture Plan v1: Implement authentication based on SHA-256 tokens';
  const submitRes = await mcpClient.callTool({
    name: 'kb_submit_result',
    arguments: {
      taskId: 'TSK-001',
      attempt: 1,
      body: planBody,
      citations: [{ recordId: 'DEC-001', rev: 1 }],
      fencingToken: claimData.fencingToken,
      baseRevisions: [{ recordId: 'DEC-001', rev: 1 }]
    }
  });
  const submitData = JSON.parse(submitRes.content[0].text);
  console.log(`Tool A submitted result -> task status: ${submitData.status}, applied: ${submitData.result.applied}`);

  await mcpClient.close();

  if (submitData.status !== 'result_saved') {
    throw new Error(`Step 2 Failed: Expected result_saved, got ${submitData.status}`);
  }
  console.log('PASS ✓: Tool A successfully claimed TSK-001 and saved result with citation DEC-001@1.');
  evidenceTable.push({
    step: 2,
    actor: 'alice',
    tool: 'claude-code (MCP)',
    action: 'submit_result',
    revision: 'DEC-001@1',
    outcome: '201 Created (result_saved)'
  });

  // =========================================================================
  // STEP 3: Tool B (NEW CLI process: antigravity) Handoff without chat history
  // =========================================================================
  printStep(3, 'Tool B (CLI Process: antigravity) Seamless Handoff via Task ID');
  console.log('Spawning completely fresh CLI subprocess given ONLY "TSK-001"...');

  const { stdout: cliContextOut } = await execFileAsync(
    'node',
    [cliScriptPath, 'context', 'TSK-001'],
    {
      env: {
        ...process.env,
        KB_URL: baseUrl,
        KB_TOKEN: bob.token,
        KB_TOOL: 'antigravity'
      }
    }
  );
  const recovered = JSON.parse(cliContextOut);

  console.log('Recovered Context from Knowledge Base:');
  console.log(`  • Task Title:   "${recovered.task.title}" (Status: ${recovered.task.status})`);
  console.log(`  • Prior Draft:  "${recovered.latestResult?.body}"`);
  console.log(`  • Cited Source: ${recovered.citedSources[0]?.recordId}@${recovered.citedSources[0]?.rev}`);
  console.log(`    Content:      "${recovered.citedSources[0]?.content.split('\n')[0]}"`);

  if (!recovered.latestResult || recovered.citedSources.length === 0) {
    throw new Error('Step 3 Failed: Tool B failed to recover context');
  }
  console.log('PASS ✓: Tool B reconstructed full task state from KB without copying any chat history.');
  evidenceTable.push({
    step: 3,
    actor: 'bob',
    tool: 'antigravity (CLI)',
    action: 'context',
    revision: 'DEC-001@1',
    outcome: '200 OK (Recovered Draft & Sources)'
  });

  // =========================================================================
  // STEP 4: Decision Revised by Lead
  // =========================================================================
  printStep(4, 'Decision Revised by Lead (DEC-001 rev 1 -> rev 2)');
  const reviseRes = await fetch(`${baseUrl}/api/records/DEC-001`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${alice.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: '# DEC-001: Revised Security Protocol (v2)\nUpgraded hashing standard from SHA-256 to Argon2.',
      baseRevision: 1
    })
  });
  const reviseData = await reviseRes.json();
  console.log(`Lead Alice updated DEC-001 -> new revision: ${reviseData.currentRevision}`);

  if (reviseData.currentRevision !== 2) {
    throw new Error(`Step 4 Failed: Expected rev 2, got ${reviseData.currentRevision}`);
  }
  console.log('PASS ✓: Decision DEC-001 successfully revised to revision 2.');
  evidenceTable.push({
    step: 4,
    actor: 'alice',
    tool: 'api',
    action: 'update_record',
    revision: 'DEC-001@2',
    outcome: '200 OK (Revised to v2)'
  });

  // =========================================================================
  // STEP 5: Stale Dependency Flags Detection
  // =========================================================================
  printStep(5, 'Stale Dependency Detection & Isolation of Independent Tasks');
  const flagsRes = await fetch(`${baseUrl}/api/flags?status=pending`, {
    headers: { 'Authorization': `Bearer ${alice.token}` }
  });
  const pendingFlags = await flagsRes.json();
  console.log(`Active pending review flags generated: ${pendingFlags.length}`);
  pendingFlags.forEach((f) => {
    console.log(`  • Flag on ${f.taskId}: ${f.reason}`);
  });

  const task1 = await Task.findOne({ taskId: 'TSK-001' });
  const task4 = await Task.findOne({ taskId: 'TSK-004' });

  console.log(`Task TSK-001 (cites DEC-001) status: ${task1.status}`);
  console.log(`Task TSK-004 (independent, cites DEC-002) status: ${task4.status}`);

  if (task1.status !== 'stale' || task4.status !== 'open') {
    throw new Error(`Step 5 Failed: Stale isolation failed. TSK-001=${task1.status}, TSK-004=${task4.status}`);
  }
  console.log('PASS ✓: Dependent tasks marked STALE; independent task TSK-004 untouched in OPEN status.');
  evidenceTable.push({
    step: 5,
    actor: 'system',
    tool: 'api',
    action: 'detect_stale',
    revision: 'DEC-001@2',
    outcome: 'TSK-001 marked STALE, TSK-004 kept OPEN'
  });

  // =========================================================================
  // STEP 6: Reviewer Approval & Role Gates
  // =========================================================================
  printStep(6, 'Reviewer Approval & Role Gating');
  const targetFlag = pendingFlags.find((f) => f.taskId === 'TSK-001');

  // 1. Bob (dev) tries to approve -> 403
  const devApproveRes = await fetch(`${baseUrl}/api/flags/${targetFlag._id}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${bob.token}` }
  });
  const devApproveBody = await devApproveRes.json();
  console.log(`Dev Bob attempted approval -> Status: ${devApproveRes.status}, Code: ${devApproveBody.code}`);
  if (devApproveRes.status !== 403) {
    throw new Error(`Step 6 Failed: Dev should receive 403, got ${devApproveRes.status}`);
  }

  // 2. Carol (reviewer) approves -> 200
  const reviewerApproveRes = await fetch(`${baseUrl}/api/flags/${targetFlag._id}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${carol.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ note: 'Reviewed diff and confirmed Argon2 upgrade.' })
  });
  const reviewerApproveBody = await reviewerApproveRes.json();
  console.log(`Reviewer Carol approved flag -> Status: ${reviewerApproveRes.status}, Message: "${reviewerApproveBody.message}"`);
  if (reviewerApproveRes.status !== 200) {
    throw new Error(`Step 6 Failed: Reviewer approval failed: ${reviewerApproveRes.status}`);
  }

  // 3. Repeat approval -> 409
  const repeatApproveRes = await fetch(`${baseUrl}/api/flags/${targetFlag._id}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${carol.token}` }
  });
  const repeatBody = await repeatApproveRes.json();
  console.log(`Repeat approval attempt -> Status: ${repeatApproveRes.status}, Code: ${repeatBody.code}`);
  if (repeatApproveRes.status !== 409 || repeatBody.code !== 'INVALID_STATE') {
    throw new Error(`Step 6 Failed: Expected 409 INVALID_STATE on repeat approval, got ${repeatApproveRes.status}`);
  }

  const task1AfterApprove = await Task.findOne({ taskId: 'TSK-001' });
  console.log(`Task TSK-001 reset status: ${task1AfterApprove.status}`);
  if (task1AfterApprove.status !== 'open') {
    throw new Error(`Step 6 Failed: Task TSK-001 should be open, got ${task1AfterApprove.status}`);
  }
  console.log('PASS ✓: Role-based approval enforced, repeat approval prevented, task reset to OPEN.');
  evidenceTable.push({
    step: 6,
    actor: 'carol',
    tool: 'api',
    action: 'approve_review_flag',
    revision: 'DEC-001@2',
    outcome: '200 OK (Task Reset to OPEN)'
  });

  // =========================================================================
  // STEP 7: Kill and Resume
  // =========================================================================
  printStep(7, 'Process Crash & Kill-Resume Guarantee');
  // Re-claim and re-submit result for TSK-001, then simulate crash before completion
  const childScript = `
    const baseUrl = '${baseUrl}';
    const token = '${bob.token}';
    async function run() {
      const claimRes = await fetch(baseUrl + '/api/tasks/TSK-001/claim', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'X-KB-Tool': 'antigravity' }
      });
      const claim = await claimRes.json();

      await fetch(baseUrl + '/api/tasks/TSK-001/result', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'X-KB-Tool': 'antigravity' },
        body: JSON.stringify({
          attempt: 2,
          body: 'Updated implementation plan adhering to Argon2 decision',
          citations: [{ recordId: 'DEC-001', rev: 2 }],
          fencingToken: claim.fencingToken,
          baseRevisions: [{ recordId: 'DEC-001', rev: 2 }]
        })
      });

      process.stdout.write('RESULT_SAVED_READY\\n');
      await new Promise(() => {}); // hang until killed
    }
    run().catch(console.error);
  `;

  const child = spawn(process.execPath, ['-e', childScript], {
    stdio: ['inherit', 'pipe', 'inherit']
  });

  await new Promise((resolve) => {
    child.stdout.on('data', (d) => {
      if (d.toString().includes('RESULT_SAVED_READY')) {
        console.log('Agent saved result to KB. Killing process abruptly with SIGKILL...');
        child.kill('SIGKILL');
        resolve();
      }
    });
  });

  await new Promise((r) => setTimeout(r, 400));
  console.log('Agent process killed. Harness now resumes task...');

  // Resume 1
  const res1 = await fetch(`${baseUrl}/api/tasks/TSK-001/resume`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${alice.token}`, 'X-KB-Tool': 'harness-recovery' }
  });
  const res1Body = await res1.json();

  // Resume 2
  const res2 = await fetch(`${baseUrl}/api/tasks/TSK-001/resume`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${alice.token}`, 'X-KB-Tool': 'harness-recovery' }
  });
  const res2Body = await res2.json();

  const totalResults = await Result.countDocuments({ taskId: 'TSK-001' });
  const appliedResults = await Result.countDocuments({ taskId: 'TSK-001', applied: true });
  const completeEvents = await Event.countDocuments({ taskId: 'TSK-001', action: 'complete_task' });

  console.log(`Results rows: ${totalResults} (history preserved)`);
  console.log(`Applied results: ${appliedResults} (exactly 1 applied)`);
  console.log(`Completion events: ${completeEvents} (exactly 1 audit event)`);

  if (appliedResults !== 1 || completeEvents !== 1 || res2Body.task.status !== 'completed') {
    throw new Error('Step 7 Failed: Kill-resume exactly-once assertion failed');
  }
  console.log('PASS ✓: Crash recovery succeeded with exactly-once applied result and audit completion.');
  evidenceTable.push({
    step: 7,
    actor: 'alice',
    tool: 'harness-recovery',
    action: 'resume',
    revision: 'DEC-001@2',
    outcome: '200 OK (Completed Exactly Once)'
  });

  // =========================================================================
  // STEP 8: Provenance Trace Chain & Evidence Table
  // =========================================================================
  printStep(8, 'Task Provenance Trace & Evidence Audit');
  const traceRes = await fetch(`${baseUrl}/api/trace/TSK-001`, {
    headers: { 'Authorization': `Bearer ${alice.token}` }
  });
  const trace = await traceRes.json();

  console.log('PROVENANCE TRACE CHAIN:');
  console.log(`  [1] Task Definition:       ${trace.task.taskId} - "${trace.task.title}"`);
  console.log(`  [2] Intercepted Flag:      ${trace.flags[0]?.flag?.reason}`);
  console.log(`  [3] Root Cause Decision:   ${trace.flags[0]?.changedRecord?.recordId} updated from rev ${trace.flags[0]?.changedRecord?.fromRev} to rev ${trace.flags[0]?.changedRecord?.toRev} by ${trace.flags[0]?.changedRecord?.changedBy}`);
  console.log(`  [4] Teammate Approval:     Approved by ${trace.flags[0]?.approvedBy}`);
  console.log(`  [5] Completed Task Status: ${trace.task.status}`);

  console.log('\nFINAL EVIDENCE AUDIT TABLE:');
  console.log('-'.repeat(85));
  console.log(
    'Step | Actor   | Tool              | Action             | Revision   | Outcome'
  );
  console.log('-'.repeat(85));
  evidenceTable.forEach((row) => {
    console.log(
      `${String(row.step).padEnd(4)} | ${row.actor.padEnd(7)} | ${row.tool.padEnd(17)} | ${row.action.padEnd(18)} | ${row.revision.padEnd(10)} | ${row.outcome}`
    );
  });
  console.log('-'.repeat(85));

  server.close();
  await mongo.stop();

  console.log('\n======================================================================');
  console.log(' ALL 8 STEPS PASSED');
  console.log('======================================================================\n');
}

if (process.argv[1]?.endsWith('demo-handover.js')) {
  runDemo().catch((err) => {
    console.error('\n❌ DEMO FAILED WITH ERROR:', err);
    process.exit(1);
  });
}
