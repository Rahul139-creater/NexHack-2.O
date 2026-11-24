import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { User } from '../server/src/models/User.js';
import { Record } from '../server/src/models/Record.js';
import { Revision } from '../server/src/models/Revision.js';
import { hashToken } from '../server/src/utils/crypto.js';

describe('Phase 5: Records List, User Profile & Revision History', () => {
  let app;
  const aliceToken = 'token_alice_lead_p5';
  const bobToken = 'token_bob_dev_p5';

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

  it('/me returns the correct user info and role', async () => {
    const aliceRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceRes.status).toBe(200);
    expect(aliceRes.body).toEqual({
      userId: 'alice',
      name: 'Alice Lead',
      role: 'lead',
      tool: 'cli'
    });

    const bobRes = await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobRes.status).toBe(200);
    expect(bobRes.body).toEqual({
      userId: 'bob',
      name: 'Bob Dev',
      role: 'dev',
      tool: 'mcp'
    });
  });

  it('GET /api/records excludes unreadable records', async () => {
    // Record readable by both
    await Record.create({
      recordId: 'DOC-SHARED',
      type: 'document',
      currentRevision: 1,
      readers: ['alice', 'bob'],
      writers: ['alice']
    });
    await Revision.create({
      recordId: 'DOC-SHARED',
      rev: 1,
      content: '# Shared Team Guidelines\nVisible to Alice and Bob.',
      author: 'alice',
      tool: 'cli'
    });

    // Record readable ONLY by Alice
    await Record.create({
      recordId: 'DOC-SECRET',
      type: 'document',
      currentRevision: 1,
      readers: ['alice'],
      writers: ['alice']
    });
    await Revision.create({
      recordId: 'DOC-SECRET',
      rev: 1,
      content: '# Secret Architecture Proposal\nAlice eyes only.',
      author: 'alice',
      tool: 'cli'
    });

    // Alice query -> sees both
    const aliceList = await request(app)
      .get('/api/records')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(aliceList.status).toBe(200);
    expect(aliceList.body.length).toBe(2);
    const aliceRecordIds = aliceList.body.map(r => r.recordId);
    expect(aliceRecordIds).toContain('DOC-SHARED');
    expect(aliceRecordIds).toContain('DOC-SECRET');

    // Bob query -> sees ONLY DOC-SHARED
    const bobList = await request(app)
      .get('/api/records')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobList.status).toBe(200);
    expect(bobList.body.length).toBe(1);
    expect(bobList.body[0].recordId).toBe('DOC-SHARED');
    expect(bobList.body[0].title).toBe('Shared Team Guidelines');
  });

  it('GET /api/records/:id/revisions returns ordered revision history', async () => {
    await Record.create({
      recordId: 'DEC-ORDER',
      type: 'decision',
      currentRevision: 3,
      readers: ['alice', 'bob'],
      writers: ['alice']
    });

    await Revision.create([
      {
        recordId: 'DEC-ORDER',
        rev: 1,
        content: '# Decision rev 1',
        author: 'alice',
        tool: 'cli',
        createdAt: new Date('2026-01-01T10:00:00Z')
      },
      {
        recordId: 'DEC-ORDER',
        rev: 2,
        content: '# Decision rev 2',
        author: 'alice',
        tool: 'cli',
        createdAt: new Date('2026-01-02T10:00:00Z')
      },
      {
        recordId: 'DEC-ORDER',
        rev: 3,
        content: '# Decision rev 3',
        author: 'alice',
        tool: 'cli',
        createdAt: new Date('2026-01-03T10:00:00Z')
      }
    ]);

    const res = await request(app)
      .get('/api/records/DEC-ORDER/revisions')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body.map(r => r.rev)).toEqual([1, 2, 3]);
    expect(res.body[0].author).toBe('alice');
    expect(res.body[1].rev).toBe(2);
    expect(res.body[2].rev).toBe(3);
  });
});
