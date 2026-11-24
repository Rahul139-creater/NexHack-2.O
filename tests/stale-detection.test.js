import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { Record } from '../server/src/models/Record.js';
import { Revision } from '../server/src/models/Revision.js';
import { Task } from '../server/src/models/Task.js';
import { Result } from '../server/src/models/Result.js';
import { ReviewFlag } from '../server/src/models/ReviewFlag.js';
import { hashToken } from '../server/src/utils/crypto.js';

describe('Phase 2: Stale Detection, Outdated Base Revision, and Historical Context', () => {
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

    // Create 2 Decisions
    await Record.create([
      {
        recordId: 'DEC-001',
        type: 'decision',
        currentRevision: 1,
        readers: ['alice', 'bob'],
        writers: ['alice', 'bob']
      },
      {
        recordId: 'DEC-002',
        type: 'decision',
        currentRevision: 1,
        readers: ['alice', 'bob'],
        writers: ['alice', 'bob']
      }
    ]);

    await Revision.create([
      {
        recordId: 'DEC-001',
        rev: 1,
        content: '# Decision 1: Original Storage Strategy',
        author: 'alice',
        tool: 'cli'
      },
      {
        recordId: 'DEC-002',
        rev: 1,
        content: '# Decision 2: Independent Security Standard',
        author: 'alice',
        tool: 'cli'
      }
    ]);

    // Task 1: Depends directly on DEC-001 rev 1
    await Task.create({
      taskId: 'TSK-001',
      title: 'Task dependent on Decision 1',
      briefRef: { recordId: 'DEC-001', rev: 1 },
      status: 'open',
      fencingToken: 0,
      dependsOn: [{ recordId: 'DEC-001', rev: 1 }]
    });

    // Task 2: Has a claimed state and result citing DEC-001 rev 1
    await Task.create({
      taskId: 'TSK-002',
      title: 'Task with saved result citing Decision 1',
      briefRef: { recordId: 'DEC-001', rev: 1 },
      status: 'result_saved',
      owner: 'bob',
      fencingToken: 1,
      dependsOn: []
    });

    await Result.create({
      taskId: 'TSK-002',
      attempt: 1,
      idempotencyKey: 'key_tsk_002_attempt_1',
      body: 'Detailed design citing DEC-001 rev 1',
      citations: [{ recordId: 'DEC-001', rev: 1 }],
      createdBy: 'bob',
      tool: 'mcp',
      applied: false
    });

    // Task 3: Independent! Only depends on DEC-002 rev 1
    await Task.create({
      taskId: 'TSK-003',
      title: 'Independent Task citing Decision 2 only',
      briefRef: { recordId: 'DEC-002', rev: 1 },
      status: 'open',
      fencingToken: 0,
      dependsOn: [{ recordId: 'DEC-002', rev: 1 }]
    });
  });

  it('revising DEC-001 marks only dependent tasks stale and creates reviewFlags, while independent task stays open', async () => {
    // 1. Update DEC-001 to rev 2
    const updateRes = await request(app)
      .put('/api/records/DEC-001')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        content: '# Decision 1: Revised Storage Strategy (v2)',
        baseRevision: 1
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.currentRevision).toBe(2);

    // 2. Check TSK-001: must become 'stale'
    const task1 = await Task.findOne({ taskId: 'TSK-001' });
    expect(task1.status).toBe('stale');

    // 3. Check TSK-002: must become 'stale' because its result cited DEC-001 rev 1
    const task2 = await Task.findOne({ taskId: 'TSK-002' });
    expect(task2.status).toBe('stale');

    // 4. Check review flags for TSK-001 and TSK-002
    const flag1 = await ReviewFlag.findOne({ taskId: 'TSK-001' });
    expect(flag1).toBeDefined();
    expect(flag1.status).toBe('pending');
    expect(flag1.changedRecord).toEqual({
      recordId: 'DEC-001',
      fromRev: 1,
      toRev: 2
    });

    const flag2 = await ReviewFlag.findOne({ taskId: 'TSK-002' });
    expect(flag2).toBeDefined();
    expect(flag2.status).toBe('pending');
    expect(flag2.changedRecord.recordId).toBe('DEC-001');

    // 5. Check TSK-003 (independent): must stay 'open' and have NO review flags
    const task3 = await Task.findOne({ taskId: 'TSK-003' });
    expect(task3.status).toBe('open');

    const flag3 = await ReviewFlag.findOne({ taskId: 'TSK-003' });
    expect(flag3).toBeNull();
  });

  it('submitting with an outdated baseRevision gives status conflict', async () => {
    // Update DEC-001 to revision 2 first
    await request(app)
      .put('/api/records/DEC-001')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        content: '# Decision 1 v2',
        baseRevision: 1
      });

    // Create and claim a new task
    await Task.create({
      taskId: 'TSK-004',
      title: 'Task testing conflict detection',
      briefRef: { recordId: 'DEC-002', rev: 1 },
      status: 'open',
      fencingToken: 0,
      dependsOn: []
    });

    const claimRes = await request(app)
      .post('/api/tasks/TSK-004/claim')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(claimRes.status).toBe(200);

    // Submit with outdated baseRevision: citing DEC-001 rev 1 when currentRevision is 2
    const submitRes = await request(app)
      .post('/api/tasks/TSK-004/result')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        attempt: 1,
        body: 'Work based on outdated decision',
        citations: [{ recordId: 'DEC-001', rev: 1 }],
        fencingToken: 1,
        baseRevisions: [{ recordId: 'DEC-001', rev: 1 }]
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.status).toBe('conflict');

    // Task in DB is in conflict status
    const task4 = await Task.findOne({ taskId: 'TSK-004' });
    expect(task4.status).toBe('conflict');

    // Result is still saved
    const savedResult = await Result.findOne({ taskId: 'TSK-004' });
    expect(savedResult).toBeDefined();
    expect(savedResult.applied).toBe(false);
  });

  it('context test: after the cited record gets a newer revision, /context still returns the originally cited revision content', async () => {
    // TSK-002 already has a result citing DEC-001 rev 1 with content:
    // "# Decision 1: Original Storage Strategy"

    // Update DEC-001 to rev 2
    await request(app)
      .put('/api/records/DEC-001')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        content: '# Decision 1: Revised Storage Strategy (v2)',
        baseRevision: 1
      });

    // Verify DEC-001 current revision is indeed 2
    const recordDoc = await Record.findOne({ recordId: 'DEC-001' });
    expect(recordDoc.currentRevision).toBe(2);

    // Call GET /api/tasks/TSK-002/context
    const contextRes = await request(app)
      .get('/api/tasks/TSK-002/context')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(contextRes.status).toBe(200);
    expect(contextRes.body.citedSources.length).toBe(1);
    expect(contextRes.body.citedSources[0]).toEqual({
      recordId: 'DEC-001',
      rev: 1,
      content: '# Decision 1: Original Storage Strategy' // Historical content preserved!
    });
  });
});
