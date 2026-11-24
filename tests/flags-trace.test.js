import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { Record } from '../server/src/models/Record.js';
import { Revision } from '../server/src/models/Revision.js';
import { Task } from '../server/src/models/Task.js';
import { ReviewFlag } from '../server/src/models/ReviewFlag.js';
import { Event } from '../server/src/models/Event.js';
import { hashToken } from '../server/src/utils/crypto.js';

describe('Phase 3: Review Flags, Permissions, Approval, and Provenance Trace', () => {
  let app;
  const aliceToken = 'token_alice_lead';
  const bobToken = 'token_bob_dev';
  const carolToken = 'token_carol_reviewer';

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
      },
      {
        userId: 'carol',
        name: 'Carol Reviewer',
        role: 'reviewer',
        tokenHash: hashToken(carolToken),
        tool: 'ui'
      }
    ]);

    await Record.create([
      {
        recordId: 'DEC-001',
        type: 'decision',
        currentRevision: 1,
        readers: ['alice', 'bob', 'carol'],
        writers: ['alice']
      },
      {
        recordId: 'DEC-002',
        type: 'decision',
        currentRevision: 1,
        readers: ['alice', 'bob', 'carol'],
        writers: ['alice']
      }
    ]);

    await Revision.create([
      {
        recordId: 'DEC-001',
        rev: 1,
        content: '# Decision: Use SHA-256 for opaque token hashing',
        author: 'alice',
        tool: 'cli'
      },
      {
        recordId: 'DEC-002',
        rev: 1,
        content: '# Decision: Independent Architecture Choice',
        author: 'alice',
        tool: 'cli'
      }
    ]);

    // Dependent task citing DEC-001
    await Task.create({
      taskId: 'TSK-301',
      title: 'Auth token implementation',
      briefRef: { recordId: 'DEC-001', rev: 1 },
      status: 'open',
      fencingToken: 0,
      dependsOn: [{ recordId: 'DEC-001', rev: 1 }]
    });

    // Independent task citing DEC-002
    await Task.create({
      taskId: 'TSK-302',
      title: 'Independent networking task',
      briefRef: { recordId: 'DEC-002', rev: 1 },
      status: 'open',
      fencingToken: 0,
      dependsOn: [{ recordId: 'DEC-002', rev: 1 }]
    });
  });

  it('handles revision, stale detection, permission enforcement, approval idempotency, and trace', async () => {
    // 1. Alice revises DEC-001 from rev 1 to rev 2
    const updateRes = await request(app)
      .put('/api/records/DEC-001')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        content: '# Decision: Use Argon2 instead of SHA-256 for hashing',
        baseRevision: 1
      });
    expect(updateRes.status).toBe(200);

    // 2. Only citing task TSK-301 becomes stale
    const task301 = await Task.findOne({ taskId: 'TSK-301' });
    expect(task301.status).toBe('stale');

    // Independent task TSK-302 is never flagged and stays open
    const task302 = await Task.findOne({ taskId: 'TSK-302' });
    expect(task302.status).toBe('open');
    const flag302 = await ReviewFlag.findOne({ taskId: 'TSK-302' });
    expect(flag302).toBeNull();

    // 3. GET /api/flags?status=pending
    const flagsRes = await request(app)
      .get('/api/flags?status=pending')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(flagsRes.status).toBe(200);
    expect(flagsRes.body.length).toBe(1);
    const flagId = flagsRes.body[0]._id;

    // 4. GET /api/flags/:id returns diff view with old and new revision contents
    const flagDetailRes = await request(app)
      .get(`/api/flags/${flagId}`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(flagDetailRes.status).toBe(200);
    expect(flagDetailRes.body.changedRecord.fromContent).toContain('Use SHA-256');
    expect(flagDetailRes.body.changedRecord.toContent).toContain('Use Argon2');

    // 5. Bob (role: dev, not lead or reviewer) attempts to approve -> 403 FORBIDDEN
    const bobApprove = await request(app)
      .post(`/api/flags/${flagId}/approve`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ note: 'Dev trying to approve' });
    expect(bobApprove.status).toBe(403);
    expect(bobApprove.body.code).toBe('FORBIDDEN');

    // 6. Carol (role: reviewer) approves the flag
    const carolApprove = await request(app)
      .post(`/api/flags/${flagId}/approve`)
      .set('Authorization', `Bearer ${carolToken}`)
      .send({ note: 'Approved updated decision' });
    expect(carolApprove.status).toBe(200);
    expect(carolApprove.body.flag.status).toBe('approved');
    expect(carolApprove.body.flag.approvedBy).toBe('carol');

    // Task TSK-301 returns to open
    const task301AfterApprove = await Task.findOne({ taskId: 'TSK-301' });
    expect(task301AfterApprove.status).toBe('open');

    // Exactly one approve audit event exists
    const approveEvents = await Event.find({ action: 'approve_review_flag' });
    expect(approveEvents.length).toBe(1);
    expect(approveEvents[0].actor).toBe('carol');

    // 7. Second approve on the same flag gives 409 INVALID_STATE and no extra audit event
    const secondApprove = await request(app)
      .post(`/api/flags/${flagId}/approve`)
      .set('Authorization', `Bearer ${carolToken}`);
    expect(secondApprove.status).toBe(409);
    expect(secondApprove.body.code).toBe('INVALID_STATE');

    const approveEventsAfter = await Event.find({ action: 'approve_review_flag' });
    expect(approveEventsAfter.length).toBe(1);

    // 8. GET /api/trace/:taskId returns complete provenance chain
    const traceRes = await request(app)
      .get('/api/trace/TSK-301')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(traceRes.status).toBe(200);
    expect(traceRes.body.task.taskId).toBe('TSK-301');
    expect(traceRes.body.flags.length).toBe(1);
    expect(traceRes.body.flags[0].changedRecord.fromContent).toContain('Use SHA-256');
    expect(traceRes.body.flags[0].changedRecord.toContent).toContain('Use Argon2');
    expect(traceRes.body.flags[0].changedRecord.changedBy).toBe('alice');
    expect(traceRes.body.flags[0].approvedBy).toBe('carol');
    expect(traceRes.body.events.length).toBeGreaterThan(0);
  });
});
