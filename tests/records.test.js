import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { Record } from '../server/src/models/Record.js';
import { Revision } from '../server/src/models/Revision.js';
import { Event } from '../server/src/models/Event.js';
import { hashToken } from '../server/src/utils/crypto.js';

describe('Phase 1: Records API & Concurrency Control', () => {
  let app;
  const aliceToken = 'token_alice_secret';
  const bobToken = 'token_bob_secret';

  beforeEach(async () => {
    app = createApp();

    // Create test users
    await User.create([
      {
        userId: 'alice',
        name: 'Alice',
        role: 'lead',
        tokenHash: hashToken(aliceToken),
        tool: 'cli'
      },
      {
        userId: 'bob',
        name: 'Bob',
        role: 'dev',
        tokenHash: hashToken(bobToken),
        tool: 'mcp'
      }
    ]);
  });

  it('missing token gives 401 UNAUTHENTICATED', async () => {
    const resWithoutHeader = await request(app).get('/api/records/BRF-001');
    expect(resWithoutHeader.status).toBe(401);
    expect(resWithoutHeader.body).toEqual({
      error: 'Missing or malformed Authorization header',
      code: 'UNAUTHENTICATED'
    });

    const resWithBadToken = await request(app)
      .get('/api/records/BRF-001')
      .set('Authorization', 'Bearer invalid_token_xyz');
    expect(resWithBadToken.status).toBe(401);
    expect(resWithBadToken.body.code).toBe('UNAUTHENTICATED');
  });

  it('create record gives rev 1 and logs an audit event', async () => {
    const res = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        type: 'brief',
        content: '# Mission Brief: Build Team KB',
        readers: ['alice', 'bob'],
        writers: ['alice']
      });

    expect(res.status).toBe(201);
    expect(res.body.recordId).toMatch(/^BRF-\d{3}$/);
    expect(res.body.currentRevision).toBe(1);
    expect(res.body.content).toBe('# Mission Brief: Build Team KB');
    expect(res.body.author).toBe('alice');

    // Verify record in DB
    const record = await Record.findOne({ recordId: res.body.recordId });
    expect(record).toBeDefined();
    expect(record.currentRevision).toBe(1);

    // Verify revision 1 in DB
    const revision = await Revision.findOne({ recordId: res.body.recordId, rev: 1 });
    expect(revision).toBeDefined();
    expect(revision.content).toBe('# Mission Brief: Build Team KB');

    // Verify audit event
    const event = await Event.findOne({
      action: 'create_record',
      'recordRefs.recordId': res.body.recordId
    });
    expect(event).toBeDefined();
    expect(event.actor).toBe('alice');
  });

  it('correct update gives rev 2 and rev 1 stays readable', async () => {
    // 1. Create record
    const createRes = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        type: 'document',
        content: 'Original document content v1',
        readers: ['alice', 'bob'],
        writers: ['alice']
      });
    expect(createRes.status).toBe(201);
    const recordId = createRes.body.recordId;

    // 2. Update record with baseRevision = 1
    const updateRes = await request(app)
      .put(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        content: 'Updated document content v2',
        baseRevision: 1
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.currentRevision).toBe(2);
    expect(updateRes.body.content).toBe('Updated document content v2');

    // 3. GET /api/records/:id returns latest revision (rev 2)
    const latestRes = await request(app)
      .get(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.currentRevision).toBe(2);
    expect(latestRes.body.content).toBe('Updated document content v2');

    // 4. GET /api/records/:id/revisions/1 returns rev 1 content
    const rev1Res = await request(app)
      .get(`/api/records/${recordId}/revisions/1`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(rev1Res.status).toBe(200);
    expect(rev1Res.body.rev).toBe(1);
    expect(rev1Res.body.content).toBe('Original document content v1');

    // 5. GET /api/records/:id/revisions/2 returns rev 2 content
    const rev2Res = await request(app)
      .get(`/api/records/${recordId}/revisions/2`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(rev2Res.status).toBe(200);
    expect(rev2Res.body.rev).toBe(2);
    expect(rev2Res.body.content).toBe('Updated document content v2');

    // Verify audit event for update
    const event = await Event.findOne({
      action: 'update_record',
      'recordRefs.recordId': recordId,
      'recordRefs.rev': 2
    });
    expect(event).toBeDefined();
    expect(event.meta.fromRev).toBe(1);
    expect(event.meta.toRev).toBe(2);
  });

  it('wrong baseRevision gives 409 REVISION_CONFLICT', async () => {
    // 1. Create record (currentRevision = 1)
    const createRes = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        type: 'decision',
        content: 'Decision content',
        readers: ['alice'],
        writers: ['alice']
      });
    const recordId = createRes.body.recordId;

    // 2. Attempt update with wrong baseRevision (e.g. 5)
    const conflictRes = await request(app)
      .put(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        content: 'Conflicting update',
        baseRevision: 5
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body).toEqual({
      error: 'Revision conflict: baseRevision 5 does not match currentRevision 1',
      code: 'REVISION_CONFLICT'
    });
  });

  it('unauthorised read gives 403 FORBIDDEN', async () => {
    // 1. Alice creates record accessible ONLY to alice
    const createRes = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        type: 'document',
        content: 'Secret plan for Alice eyes only',
        readers: ['alice'],
        writers: ['alice']
      });
    const recordId = createRes.body.recordId;

    // 2. Bob attempts to read latest revision
    const bobReadRes = await request(app)
      .get(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobReadRes.status).toBe(403);
    expect(bobReadRes.body.code).toBe('FORBIDDEN');

    // 3. Bob attempts to read revision 1
    const bobRevReadRes = await request(app)
      .get(`/api/records/${recordId}/revisions/1`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobRevReadRes.status).toBe(403);
    expect(bobRevReadRes.body.code).toBe('FORBIDDEN');
  });

  it('unauthorised write gives 403 FORBIDDEN', async () => {
    // 1. Alice creates record readable by Bob, but only writable by Alice
    const createRes = await request(app)
      .post('/api/records')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        type: 'document',
        content: 'Public read, restricted write',
        readers: ['alice', 'bob'],
        writers: ['alice']
      });
    const recordId = createRes.body.recordId;

    // 2. Bob can read it
    const bobReadRes = await request(app)
      .get(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobReadRes.status).toBe(200);

    // 3. Bob attempts to write to it
    const bobWriteRes = await request(app)
      .put(`/api/records/${recordId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        content: 'Bob unauthorized modification',
        baseRevision: 1
      });

    expect(bobWriteRes.status).toBe(403);
    expect(bobWriteRes.body.code).toBe('FORBIDDEN');
  });
});
