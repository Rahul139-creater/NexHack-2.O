import path from 'path';
import { spawn } from 'child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { Record } from '../server/src/models/Record.js';
import { Revision } from '../server/src/models/Revision.js';
import { Task } from '../server/src/models/Task.js';
import { Result } from '../server/src/models/Result.js';
import { Event } from '../server/src/models/Event.js';
import { hashToken } from '../server/src/utils/crypto.js';

export async function runKillResumeDemo() {
  console.log('======================================================================');
  console.log(' DEMO: CRASH RESILIENCE & RECOVERY (KILL & RESUME)');
  console.log('======================================================================\n');

  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  const { connectDB } = await import('../server/src/db.js');
  await connectDB(uri);

  const app = createApp();
  let server;
  const port = await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
  const baseUrl = `http://127.0.0.1:${port}`;

  const workerToken = 'token_worker_agent_crash_demo';
  await User.create({
    userId: 'worker-agent',
    name: 'Worker Agent',
    role: 'dev',
    tokenHash: hashToken(workerToken),
    tool: 'crash-worker'
  });

  await Record.create({
    recordId: 'DOC-RECOVERY',
    type: 'document',
    currentRevision: 1,
    readers: ['worker-agent'],
    writers: ['worker-agent']
  });
  await Revision.create({
    recordId: 'DOC-RECOVERY',
    rev: 1,
    content: '# Recovery Demo Spec',
    author: 'worker-agent',
    tool: 'crash-worker'
  });

  const taskId = 'TSK-CRASH-001';
  await Task.create({
    taskId,
    title: 'Crash Recovery Demo Task',
    briefRef: { recordId: 'DOC-RECOVERY', rev: 1 },
    status: 'open',
    fencingToken: 0,
    dependsOn: []
  });

  console.log(`[1] Created task ${taskId} (status: open). Spawning agent worker child process...`);

  // Child script code to claim, submit result, and notify before crashing
  const childScript = `
    const baseUrl = '${baseUrl}';
    const token = '${workerToken}';

    async function run() {
      // 1. Claim
      const claimRes = await fetch(baseUrl + '/api/tasks/${taskId}/claim', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'X-KB-Tool': 'crash-worker' }
      });
      const claimData = await claimRes.json();

      // 2. Submit result
      const submitRes = await fetch(baseUrl + '/api/tasks/${taskId}/result', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'X-KB-Tool': 'crash-worker'
        },
        body: JSON.stringify({
          attempt: 1,
          body: 'Result computed just before sudden power loss or process kill',
          citations: [{ recordId: 'DOC-RECOVERY', rev: 1 }],
          fencingToken: claimData.fencingToken,
          baseRevisions: [{ recordId: 'DOC-RECOVERY', rev: 1 }]
        })
      });
      const submitData = await submitRes.json();

      // Notify parent to kill us
      process.stdout.write('RESULT_SAVED_READY_FOR_KILL\\n');

      // Keep running indefinitely so parent can SIGKILL us
      await new Promise(() => {});
    }

    run().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `;

  const child = spawn(process.execPath, ['-e', childScript], {
    stdio: ['inherit', 'pipe', 'inherit']
  });

  await new Promise((resolve, reject) => {
    child.stdout.on('data', (data) => {
      if (data.toString().includes('RESULT_SAVED_READY_FOR_KILL')) {
        console.log(`[2] Worker process saved result to KB. Killing worker with SIGKILL...`);
        child.kill('SIGKILL');
        resolve();
      }
    });
    child.on('error', reject);
  });

  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log(`[3] Worker process killed. Status in KB is now 'result_saved', but completion was never reported.`);

  const taskAfterKill = await Task.findOne({ taskId });
  console.log(`    Current task state in DB: status=${taskAfterKill.status}`);

  console.log(`[4] Recovery Agent calls resume for the first time...`);
  const resume1Res = await fetch(`${baseUrl}/api/tasks/${taskId}/resume`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${workerToken}` }
  });
  const resume1 = await resume1Res.json();
  console.log(`    First resume response: status=${resume1.task.status}, message="${resume1.message}"`);

  console.log(`[5] Recovery Agent calls resume a SECOND time (testing idempotency)...`);
  const resume2Res = await fetch(`${baseUrl}/api/tasks/${taskId}/resume`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${workerToken}` }
  });
  const resume2 = await resume2Res.json();
  console.log(`    Second resume response: status=${resume2.task.status}, message="${resume2.message}"`);

  // Assertions
  const totalResults = await Result.countDocuments({ taskId });
  const appliedResults = await Result.countDocuments({ taskId, applied: true });
  const completionEvents = await Event.countDocuments({ taskId, action: 'complete_task' });

  console.log('\n--- VERIFICATION AUDIT ---');
  console.log(`• Total Results Rows:       ${totalResults} (Expected: 1) ${totalResults === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`• Applied Results:          ${appliedResults} (Expected: 1) ${appliedResults === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`• Completion Audit Events:  ${completionEvents} (Expected: 1) ${completionEvents === 1 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`• Final Task Status:        ${resume2.task.status} (Expected: completed) ${resume2.task.status === 'completed' ? 'PASS ✓' : 'FAIL ✗'}`);

  server.close();
  await mongo.stop();

  if (totalResults !== 1 || appliedResults !== 1 || completionEvents !== 1 || resume2.task.status !== 'completed') {
    console.error('\n❌ KILL & RESUME DEMO FAILED!');
    process.exit(1);
  }

  console.log('\n======================================================================');
  console.log(' ALL RECOVERY ASSERTIONS PASSED (EXACTLY-ONCE COMPLETION GUARANTEE)');
  console.log('======================================================================\n');
}

if (process.argv[1]?.endsWith('kill-resume-demo.js')) {
  runKillResumeDemo().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
