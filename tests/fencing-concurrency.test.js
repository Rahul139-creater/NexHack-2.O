import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { Record } from '../server/src/models/Record.js';
import { Revision } from '../server/src/models/Revision.js';
import { Task } from '../server/src/models/Task.js';
import { Result } from '../server/src/models/Result.js';
import { Event } from '../server/src/models/Event.js';
import { hashToken } from '../server/src/utils/crypto.js';

describe('Phase 2: Fencing, Concurrency, and Idempotency', () => {
  let app;
  const aliceToken = 'token_alice_lead';
  const bobToken = 'token_bob_dev';

  beforeEach(async () => {
    app = createApp();

    await User.create([
      {
        userId: 'alice',
        name: 'Alice Lead',
        role: 'lead',
        tokenHash: hashToken(aliceToken),
        tool: 'cli'
      },
      {
        userId: 'bob',
        name: 'Bob Dev',
        role: 'dev',
        tokenHash: hashToken(bobToken),
        tool: 'mcp'
      }
    ]);

    await Record.create({
      recordId: 'DOC-001',
      type: 'document',
      currentRevision: 1,
      readers: ['alice', 'bob'],
      writers: ['alice', 'bob']
    });

    await Revision.create({
      recordId: 'DOC-001',
      rev: 1,
      content: 'Initial specification document',
      author: 'alice',
      tool: 'cli'
    });

    await Task.create({
      taskId: 'TSK-100',
      title: 'Concurrency Benchmark Task',
      briefRef: { recordId: 'DOC-001', rev: 1 },
      status: 'open',
      fencingToken: 0,
      dependsOn: []
    });
  });

  it('two users claim the same task, so the second gets 409 INVALID_STATE', async () => {
    // First claim succeeds
    const firstClaim = await request(app)
      .post('/api/tasks/TSK-100/claim')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(firstClaim.status).toBe(200);
    expect(firstClaim.body.fencingToken).toBe(1);

    // Second claim fails with 409 INVALID_STATE because task is already claimed
    const secondClaim = await request(app)
      .post('/api/tasks/TSK-100/claim')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(secondClaim.status).toBe(409);
    expect(secondClaim.body.code).toBe('INVALID_STATE');
  });

  it('submit with an old fencingToken gives 409 LEASE_LOST', async () => {
    // Alice claims (fencingToken becomes 1)
    await request(app)
      .post('/api/tasks/TSK-100/claim')
      .set('Authorization', `Bearer ${aliceToken}`);

    // Simulate task becoming stale and re-claimed, bumping fencingToken to 2
    await Task.updateOne({ taskId: 'TSK-100' }, { status: 'stale' });
    const secondClaim = await request(app)
      .post('/api/tasks/TSK-100/claim')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(secondClaim.body.fencingToken).toBe(2);

    // Submitting with old fencingToken (1) is rejected with 409 LEASE_LOST
    const submitOld = await request(app)
      .post('/api/tasks/TSK-100/result')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        attempt: 1,
        body: 'Outdated worker output',
        citations: [{ recordId: 'DOC-001', rev: 1 }],
        fencingToken: 1,
        baseRevisions: [{ recordId: 'DOC-001', rev: 1 }]
      });

    expect(submitOld.status).toBe(409);
    expect(submitOld.body.code).toBe('LEASE_LOST');
  });

  it('duplicate submit creates exactly one results row and returns 200', async () => {
    // Alice claims task
    await request(app)
      .post('/api/tasks/TSK-100/claim')
      .set('Authorization', `Bearer ${aliceToken}`);

    const payload = {
      attempt: 1,
      body: 'Idempotent task submission payload',
      citations: [{ recordId: 'DOC-001', rev: 1 }],
      fencingToken: 1,
      baseRevisions: [{ recordId: 'DOC-001', rev: 1 }]
    };

    // First submit creates result row
    const firstSubmit = await request(app)
      .post('/api/tasks/TSK-100/result')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send(payload);
    expect(firstSubmit.status).toBe(201);
    expect(firstSubmit.body.status).toBe('result_saved');

    // Second submit with identical taskId, attempt, body is idempotent
    const secondSubmit = await request(app)
      .post('/api/tasks/TSK-100/result')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send(payload);
    expect(secondSubmit.status).toBe(200);
    expect(secondSubmit.body.idempotent).toBe(true);

    // Verify exactly one results row exists
    const resultsCount = await Result.countDocuments({ taskId: 'TSK-100' });
    expect(resultsCount).toBe(1);
  });

  it('resume called twice gives one completion audit event and one applied result', async () => {
    // 1. Claim and submit result
    await request(app)
      .post('/api/tasks/TSK-100/claim')
      .set('Authorization', `Bearer ${aliceToken}`);

    await request(app)
      .post('/api/tasks/TSK-100/result')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        attempt: 1,
        body: 'Completed work item',
        citations: [{ recordId: 'DOC-001', rev: 1 }],
        fencingToken: 1,
        baseRevisions: [{ recordId: 'DOC-001', rev: 1 }]
      });

    // 2. First resume call
    const firstResume = await request(app)
      .post('/api/tasks/TSK-100/resume')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(firstResume.status).toBe(200);
    expect(firstResume.body.task.status).toBe('completed');

    // 3. Second resume call
    const secondResume = await request(app)
      .post('/api/tasks/TSK-100/resume')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(secondResume.status).toBe(200);
    expect(secondResume.body.task.status).toBe('completed');
    expect(secondResume.body.message).toBe('Task already completed');

    // Verify exactly one complete_task audit event was written
    const completionEvents = await Event.find({ taskId: 'TSK-100', action: 'complete_task' });
    expect(completionEvents.length).toBe(1);

    // Verify result is marked applied
    const appliedResults = await Result.find({ taskId: 'TSK-100', applied: true });
    expect(appliedResults.length).toBe(1);
  });
});
