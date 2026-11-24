import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { Record } from '../server/src/models/Record.js';
import { Revision } from '../server/src/models/Revision.js';
import { Task } from '../server/src/models/Task.js';
import { Event } from '../server/src/models/Event.js';
import { hashToken } from '../server/src/utils/crypto.js';

describe('Phase 3: Expired Lease Recovery & Fencing Invalidation', () => {
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
      content: '# Document 1',
      author: 'alice',
      tool: 'cli'
    });

    await Task.create({
      taskId: 'TSK-200',
      title: 'Task for testing expired lease recovery',
      briefRef: { recordId: 'DOC-001', rev: 1 },
      status: 'open',
      fencingToken: 0,
      dependsOn: []
    });
  });

  it('reclaims expired lease, invalidates old fencingToken with 409 LEASE_LOST, and allows new owner to submit', async () => {
    // 1. Alice claims the task
    const aliceClaim = await request(app)
      .post('/api/tasks/TSK-200/claim')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceClaim.status).toBe(200);
    expect(aliceClaim.body.fencingToken).toBe(1);
    expect(aliceClaim.body.task.owner).toBe('alice');

    // 2. Force lease.expiresAt into the past in MongoDB
    const pastTime = new Date(Date.now() - 60000); // 1 minute in the past
    await Task.updateOne({ taskId: 'TSK-200' }, { 'lease.expiresAt': pastTime });

    // 3. Bob reclaims the expired task
    const bobReclaim = await request(app)
      .post('/api/tasks/TSK-200/claim')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobReclaim.status).toBe(200);
    expect(bobReclaim.body.fencingToken).toBe(2);
    expect(bobReclaim.body.task.owner).toBe('bob');

    // Verify reclaim_expired_lease audit event
    const reclaimEvent = await Event.findOne({
      taskId: 'TSK-200',
      action: 'reclaim_expired_lease'
    });
    expect(reclaimEvent).toBeDefined();
    expect(reclaimEvent.actor).toBe('bob');
    expect(reclaimEvent.meta.previousOwner).toBe('alice');
    expect(reclaimEvent.meta.fencingToken).toBe(2);

    // 4. Alice (the old owner) attempts submit with old fencingToken (1) -> 409 LEASE_LOST
    const aliceSubmit = await request(app)
      .post('/api/tasks/TSK-200/result')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        attempt: 1,
        body: 'Alice late submission',
        citations: [{ recordId: 'DOC-001', rev: 1 }],
        fencingToken: 1,
        baseRevisions: [{ recordId: 'DOC-001', rev: 1 }]
      });
    expect(aliceSubmit.status).toBe(409);
    expect(aliceSubmit.body.code).toBe('LEASE_LOST');

    // 5. Bob (new owner) submits with valid fencingToken (2) -> 201 Created
    const bobSubmit = await request(app)
      .post('/api/tasks/TSK-200/result')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        attempt: 1,
        body: 'Bob valid submission',
        citations: [{ recordId: 'DOC-001', rev: 1 }],
        fencingToken: 2,
        baseRevisions: [{ recordId: 'DOC-001', rev: 1 }]
      });
    expect(bobSubmit.status).toBe(201);
    expect(bobSubmit.body.status).toBe('result_saved');
    expect(bobSubmit.body.result.createdBy).toBe('bob');
  });
});
