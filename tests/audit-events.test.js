import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { hashToken } from '../server/src/utils/crypto.js';

describe('Phase 3: Audit Trail & Events Querying', () => {
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
  });

  it('every mutating action produces an audit event with actor, tool, and recordRefs; /events filter works', async () => {
    // 1. Create a record (action: create_record)
    const createRecRes = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        type: 'brief',
        content: '# Brief v1',
        readers: ['alice', 'bob'],
        writers: ['alice']
      });
    const recordId = createRecRes.body.recordId;

    // 2. Update the record (action: update_record)
    await request(app)
      .put(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        content: '# Brief v2',
        baseRevision: 1
      });

    // 3. Create a task (action: create_task)
    const createTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        title: 'Audit Verification Task',
        briefRef: { recordId, rev: 2 }
      });
    const taskId = createTaskRes.body.taskId;

    // 4. Claim the task (action: claim_task)
    const claimRes = await request(app)
      .post(`/api/tasks/${taskId}/claim`)
      .set('Authorization', `Bearer ${bobToken}`);
    const fencingToken = claimRes.body.fencingToken;

    // 5. Submit result (action: submit_result)
    await request(app)
      .post(`/api/tasks/${taskId}/result`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        attempt: 1,
        body: 'Task result execution output',
        citations: [{ recordId, rev: 2 }],
        fencingToken,
        baseRevisions: [{ recordId, rev: 2 }]
      });

    // 6. Complete task (action: complete_task)
    await request(app)
      .post(`/api/tasks/${taskId}/resume`)
      .set('Authorization', `Bearer ${aliceToken}`);

    // Query all events
    const allEventsRes = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(allEventsRes.status).toBe(200);
    expect(allEventsRes.body.length).toBeGreaterThanOrEqual(6);

    // Verify every event has actor, tool, action, and timestamp
    for (const ev of allEventsRes.body) {
      expect(ev.actor).toBeTruthy();
      expect(ev.tool).toBeTruthy();
      expect(ev.action).toBeTruthy();
      expect(ev.timestamp).toBeTruthy();
    }

    // Query events filtered by taskId
    const taskEventsRes = await request(app)
      .get(`/api/events?taskId=${taskId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(taskEventsRes.status).toBe(200);
    expect(taskEventsRes.body.length).toBe(4); // create_task, claim_task, submit_result, complete_task
    const taskActions = taskEventsRes.body.map(e => e.action);
    expect(taskActions).toContain('create_task');
    expect(taskActions).toContain('claim_task');
    expect(taskActions).toContain('submit_result');
    expect(taskActions).toContain('complete_task');

    // Query events filtered by recordId
    const recordEventsRes = await request(app)
      .get(`/api/events?recordId=${recordId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(recordEventsRes.status).toBe(200);
    const recActions = recordEventsRes.body.map(e => e.action);
    expect(recActions).toContain('create_record');
    expect(recActions).toContain('update_record');
  });

  it('two requests by the same user with different X-KB-Tool values produce events with different tool labels', async () => {
    // Request 1 with X-KB-Tool: "claude-code"
    const res1 = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-KB-Tool', 'claude-code')
      .send({
        type: 'document',
        content: 'Created via Claude Code tool'
      });
    expect(res1.status).toBe(201);
    const rec1Id = res1.body.recordId;

    // Request 2 with X-KB-Tool: "antigravity"
    const res2 = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('X-KB-Tool', 'antigravity')
      .send({
        type: 'document',
        content: 'Created via Antigravity tool'
      });
    expect(res2.status).toBe(201);
    const rec2Id = res2.body.recordId;

    // Query events for both
    const ev1Res = await request(app)
      .get(`/api/events?recordId=${rec1Id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(ev1Res.body[0].tool).toBe('claude-code');

    const ev2Res = await request(app)
      .get(`/api/events?recordId=${rec2Id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(ev2Res.body[0].tool).toBe('antigravity');
  });
});
