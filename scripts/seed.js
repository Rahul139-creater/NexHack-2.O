import mongoose from 'mongoose';
import { config } from '../server/src/config.js';
import { hashToken } from '../server/src/utils/crypto.js';
import { User } from '../server/src/models/User.js';
import { Record } from '../server/src/models/Record.js';
import { Revision } from '../server/src/models/Revision.js';
import { Task } from '../server/src/models/Task.js';
import { Counter } from '../server/src/models/Counter.js';
import { Event } from '../server/src/models/Event.js';
import { ReviewFlag } from '../server/src/models/ReviewFlag.js';
import { Result } from '../server/src/models/Result.js';

export const SEED_USERS = [
  {
    userId: 'alice',
    name: 'Alice Lead',
    role: 'lead',
    token: 'token_alice_lead_dev_secret_key_123',
    tool: 'cli'
  },
  {
    userId: 'bob',
    name: 'Bob Developer',
    role: 'dev',
    token: 'token_bob_dev_secret_key_456',
    tool: 'mcp'
  },
  {
    userId: 'carol',
    name: 'Carol Reviewer',
    role: 'reviewer',
    token: 'token_carol_reviewer_secret_key_789',
    tool: 'ui'
  }
];

export async function seedDatabase(uri = config.mongodbUri) {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  // Clear collections
  await User.deleteMany({});
  await Record.deleteMany({});
  await Revision.deleteMany({});
  await Task.deleteMany({});
  await Result.deleteMany({});
  await Event.deleteMany({});
  await ReviewFlag.deleteMany({});
  await Counter.deleteMany({});

  console.log('Seeding Users...');
  for (const u of SEED_USERS) {
    await User.create({
      userId: u.userId,
      name: u.name,
      role: u.role,
      tokenHash: hashToken(u.token),
      tool: u.tool
    });
  }

  // Set sequence counters
  await Counter.create([
    { _id: 'BRF', seq: 1 },
    { _id: 'DEC', seq: 2 },
    { _id: 'DOC', seq: 3 },
    { _id: 'TSK', seq: 4 }
  ]);

  console.log('Seeding 1 Brief...');
  await Record.create({
    recordId: 'BRF-001',
    type: 'brief',
    currentRevision: 1,
    readers: ['alice', 'bob', 'carol'],
    writers: ['alice']
  });
  await Revision.create({
    recordId: 'BRF-001',
    rev: 1,
    content: '# Project Brief: Shared Multi-Agent Team Knowledge Base\nDesign and execute a multi-agent harness enabling seamless work handoffs.',
    author: 'alice',
    tool: 'cli'
  });

  console.log('Seeding 2 Decisions...');
  await Record.create({
    recordId: 'DEC-001',
    type: 'decision',
    currentRevision: 1,
    readers: ['alice', 'bob', 'carol'],
    writers: ['alice', 'bob']
  });
  await Revision.create({
    recordId: 'DEC-001',
    rev: 1,
    content: '# DEC-001: Storage & Security Protocol\nUse SHA-256 for opaque token hashing and MongoDB conditional atomic updates.',
    author: 'alice',
    tool: 'cli'
  });

  await Record.create({
    recordId: 'DEC-002',
    type: 'decision',
    currentRevision: 1,
    readers: ['alice', 'bob', 'carol'],
    writers: ['alice', 'bob']
  });
  await Revision.create({
    recordId: 'DEC-002',
    rev: 1,
    content: '# DEC-002: Fencing & Lease Protocol\nUse monotonic fencing tokens and lease expiration to prevent zombie writes.',
    author: 'alice',
    tool: 'cli'
  });

  console.log('Seeding 3 Documents...');
  const documents = [
    {
      recordId: 'DOC-001',
      title: 'DOC-001: API Endpoint Specification',
      content: '# API Specification\nStandard endpoints under /api with Zod validation.'
    },
    {
      recordId: 'DOC-002',
      title: 'DOC-002: MCP Stdio Adapter Protocol',
      content: '# MCP Adapter Protocol\nStdio transport connecting Claude/Gemini tools to Team KB.'
    },
    {
      recordId: 'DOC-003',
      title: 'DOC-003: Provenance & Audit System',
      content: '# Audit System\nEvery mutating request logs an event with recordRefs.'
    }
  ];

  for (const doc of documents) {
    await Record.create({
      recordId: doc.recordId,
      type: 'document',
      currentRevision: 1,
      readers: ['alice', 'bob', 'carol'],
      writers: ['alice', 'bob']
    });
    await Revision.create({
      recordId: doc.recordId,
      rev: 1,
      content: doc.content,
      author: 'alice',
      tool: 'cli'
    });
  }

  console.log('Seeding 4 Tasks...');
  // Task 1, 2, 3 cite DEC-001 (which will change later to trigger stale detection)
  // Task 4 MUST NOT cite DEC-001 (only cites DEC-002)
  await Task.create([
    {
      taskId: 'TSK-001',
      title: 'Implement Authentication & Access Controls',
      briefRef: { recordId: 'BRF-001', rev: 1 },
      status: 'open',
      owner: null,
      tool: null,
      fencingToken: 0,
      nextAction: 'Claim task and build auth middleware',
      dependsOn: [{ recordId: 'DEC-001', rev: 1 }]
    },
    {
      taskId: 'TSK-002',
      title: 'Implement Atomic Records Management',
      briefRef: { recordId: 'BRF-001', rev: 1 },
      status: 'open',
      owner: null,
      tool: null,
      fencingToken: 0,
      nextAction: 'Build record creation and optimistic concurrency updates',
      dependsOn: [{ recordId: 'DEC-001', rev: 1 }]
    },
    {
      taskId: 'TSK-003',
      title: 'Build Stale Dependency Detector',
      briefRef: { recordId: 'BRF-001', rev: 1 },
      status: 'open',
      owner: null,
      tool: null,
      fencingToken: 0,
      nextAction: 'Detect modified citations and flag dependent tasks',
      dependsOn: [{ recordId: 'DEC-001', rev: 1 }]
    },
    {
      taskId: 'TSK-004',
      title: 'Implement Distributed Fencing and Lease Control',
      briefRef: { recordId: 'BRF-001', rev: 1 },
      status: 'open',
      owner: null,
      tool: null,
      fencingToken: 0,
      nextAction: 'Ensure monotonic fencing tokens prevent stale writes',
      dependsOn: [{ recordId: 'DEC-002', rev: 1 }] // DOES NOT CITE DEC-001!
    }
  ]);

  console.log('Database seeded successfully!\n');
  console.log('================= SEEDED USERS & DEV TOKENS =================');
  SEED_USERS.forEach(u => {
    console.log(`User: ${u.userId.padEnd(8)} | Role: ${u.role.padEnd(10)} | Token: ${u.token}`);
  });
  console.log('=============================================================\n');
}

if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
