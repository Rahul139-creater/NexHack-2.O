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

describe('Phase 2: Task Lifecycle (claim, submit, context, resume)', () => {
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

    // Create a brief and a decision
    await Record.create([
      {
        recordId: 'BRF-001',
        type: 'brief',
        currentRevision: 1,
        readers: ['alice', 'bob'],
        writers: ['alice']
      },
      {
        recordId: 'DEC-001',
        type: 'decision',
        currentRevision: 1,
        readers: ['alice', 'bob'],
        writers: ['alice', 'bob']
      }
    ]);

    await Revision.create([
      {
        recordId: 'BRF-001',
        rev: 1,
        content: '# Brief: Multi-Agent Harness',
        author: 'alice',
        tool: 'cli'
      },
      {
        recordId: 'DEC-001',
        rev: 1,
        content: '# DEC-001: Storage in MongoDB',
        author: 'alice',
        tool: 'cli'
      }
    ]);

    // Create an open task
    await Task.create({
      taskId: 'TSK-001',
      title: 'Implement Database Connector',
      briefRef: { recordId: 'BRF-001', rev: 1 },
      status: 'open',
      fencingToken: 0,
      dependsOn: [{ recordId: 'DEC-001', rev: 1 }]
    });
  });

  it('GET /api/tasks lists tasks and filters by status', async () => {
    const listRes = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].taskId).toBe('TSK-001');

    const openRes = await request(app)
      .get('/api/tasks?status=open')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(openRes.status).toBe(200);
    expect(openRes.body.length).toBe(1);

    const completedRes = await request(app)
      .get('/api/tasks?status=completed')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(completedRes.status).toBe(200);
    expect(completedRes.body.length).toBe(0);

    const detailRes = await request(app)
      .get('/api/tasks/TSK-001')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.taskId).toBe('TSK-001');
    expect(detailRes.body.status).toBe('open');
  });

  it('happy path: claim -> submit -> context -> resume', async () => {
    // 1. Claim task
    const claimRes = await request(app)
      .post('/api/tasks/TSK-001/claim')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.fencingToken).toBe(1);
    expect(claimRes.body.task.status).toBe('claimed');
    expect(claimRes.body.task.owner).toBe('bob');
    expect(claimRes.body.task.tool).toBe('mcp');
    expect(new Date(claimRes.body.task.lease.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Verify claim audit event
    const claimAudit = await Event.findOne({ taskId: 'TSK-001', action: 'claim_task' });
    expect(claimAudit).toBeDefined();
    expect(claimAudit.actor).toBe('bob');
    expect(claimAudit.meta.fencingToken).toBe(1);

    // 2. Submit result
    const resultBody = { plan: 'Implement schema with indexes', codeReady: true };
    const submitRes = await request(app)
      .post('/api/tasks/TSK-001/result')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        attempt: 1,
        body: resultBody,
        citations: [{ recordId: 'DEC-001', rev: 1 }],
        fencingToken: 1,
        baseRevisions: [{ recordId: 'DEC-001', rev: 1 }]
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.status).toBe('result_saved');
    expect(submitRes.body.result.applied).toBe(false);
    expect(submitRes.body.result.citations).toEqual([{ recordId: 'DEC-001', rev: 1 }]);

    // Verify task state in DB
    const taskAfterSubmit = await Task.findOne({ taskId: 'TSK-001' });
    expect(taskAfterSubmit.status).toBe('result_saved');

    // Verify submit audit event listing citations
    const submitAudit = await Event.findOne({ taskId: 'TSK-001', action: 'submit_result' });
    expect(submitAudit).toBeDefined();
    expect(submitAudit.recordRefs[0].recordId).toBe('DEC-001');

    // 3. GET context
    const contextRes = await request(app)
      .get('/api/tasks/TSK-001/context')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(contextRes.status).toBe(200);
    expect(contextRes.body.task.taskId).toBe('TSK-001');
    expect(contextRes.body.latestResult).toBeDefined();
    expect(contextRes.body.citedSources.length).toBe(1);
    expect(contextRes.body.citedSources[0]).toEqual({
      recordId: 'DEC-001',
      rev: 1,
      content: '# DEC-001: Storage in MongoDB'
    });

    // 4. Resume (complete) task
    const resumeRes = await request(app)
      .post('/api/tasks/TSK-001/resume')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.task.status).toBe('completed');

    // Verify result applied is now true
    const savedResult = await Result.findOne({ taskId: 'TSK-001' });
    expect(savedResult.applied).toBe(true);

    // Verify completion audit event
    const completeAudit = await Event.findOne({ taskId: 'TSK-001', action: 'complete_task' });
    expect(completeAudit).toBeDefined();
    expect(completeAudit.actor).toBe('alice');
  });
});
