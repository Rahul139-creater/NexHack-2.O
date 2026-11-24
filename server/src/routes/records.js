import { Router } from 'express';
import { Record } from '../models/Record.js';
import { Revision } from '../models/Revision.js';
import { generateId } from '../utils/idGenerator.js';
import { recordAudit } from '../utils/audit.js';
import { detectAndFlagStaleTasks } from '../utils/staleDetector.js';
import { validate } from '../middleware/validate.js';
import {
  createRecordSchema,
  updateRecordSchema
} from '../validators/schemas.js';
import {
  notFound,
  forbidden,
  revisionConflict
} from '../middleware/errorHandler.js';

export const recordsRouter = Router();

// GET /api/records - list records the caller can read
recordsRouter.get('/', async (req, res, next) => {
  try {
    const records = await Record.find({ readers: req.user.userId }).sort({ updatedAt: -1 });
    const results = [];
    for (const r of records) {
      const rev = await Revision.findOne({ recordId: r.recordId, rev: r.currentRevision });
      const firstLine = rev?.content?.split('\n')[0]?.replace(/^#+\s*/, '') || '';
      results.push({
        recordId: r.recordId,
        type: r.type,
        currentRevision: r.currentRevision,
        title: firstLine,
        updatedAt: r.updatedAt
      });
    }
    return res.status(200).json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/records/:id - latest revision + metadata (requires read permission)
recordsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await Record.findOne({ recordId: id });
    if (!record) {
      throw notFound(`Record ${id} not found`);
    }

    // Check read permission
    if (!record.readers.includes(req.user.userId)) {
      throw forbidden(`User ${req.user.userId} does not have read permission for ${id}`);
    }

    const revision = await Revision.findOne({
      recordId: id,
      rev: record.currentRevision
    });

    return res.status(200).json({
      recordId: record.recordId,
      type: record.type,
      currentRevision: record.currentRevision,
      readers: record.readers,
      writers: record.writers,
      content: revision ? revision.content : '',
      author: revision ? revision.author : null,
      tool: revision ? revision.tool : null,
      createdAt: revision ? revision.createdAt : record.createdAt,
      updatedAt: record.updatedAt
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/records/:id/revisions - revision history list (ordered)
recordsRouter.get('/:id/revisions', async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await Record.findOne({ recordId: id });
    if (!record) {
      throw notFound(`Record ${id} not found`);
    }

    if (!record.readers.includes(req.user.userId)) {
      throw forbidden(`User ${req.user.userId} does not have read permission for ${id}`);
    }

    const revisions = await Revision.find({ recordId: id }).sort({ rev: 1 });
    const list = revisions.map(r => ({
      rev: r.rev,
      author: r.author,
      tool: r.tool,
      createdAt: r.createdAt
    }));
    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/records/:id/revisions/:rev - specific revision
recordsRouter.get('/:id/revisions/:rev', async (req, res, next) => {
  try {
    const { id, rev } = req.params;
    const parsedRev = parseInt(rev, 10);
    if (isNaN(parsedRev) || parsedRev < 1) {
      throw notFound(`Invalid revision number: ${rev}`);
    }

    const record = await Record.findOne({ recordId: id });
    if (!record) {
      throw notFound(`Record ${id} not found`);
    }

    // Check read permission
    if (!record.readers.includes(req.user.userId)) {
      throw forbidden(`User ${req.user.userId} does not have read permission for ${id}`);
    }

    const revision = await Revision.findOne({
      recordId: id,
      rev: parsedRev
    });
    if (!revision) {
      throw notFound(`Revision ${parsedRev} not found for record ${id}`);
    }

    return res.status(200).json({
      recordId: record.recordId,
      type: record.type,
      rev: revision.rev,
      content: revision.content,
      author: revision.author,
      tool: revision.tool,
      createdAt: revision.createdAt,
      readers: record.readers,
      writers: record.writers
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/records - create record (rev 1)
recordsRouter.post('/', validate(createRecordSchema), async (req, res, next) => {
  try {
    const { type, content, readers, writers, recordId: customId } = req.body;

    const recordId = customId || (await generateId(type));

    // Default readers and writers include the creator if not provided
    const effectiveReaders = Array.isArray(readers) && readers.length > 0
      ? [...new Set([...readers, req.user.userId])]
      : [req.user.userId];

    const effectiveWriters = Array.isArray(writers) && writers.length > 0
      ? [...new Set([...writers, req.user.userId])]
      : [req.user.userId];

    const record = await Record.create({
      recordId,
      type,
      currentRevision: 1,
      readers: effectiveReaders,
      writers: effectiveWriters
    });

    const revision = await Revision.create({
      recordId,
      rev: 1,
      content,
      author: req.user.userId,
      tool: req.tool,
      createdAt: new Date()
    });

    // Mandatory audit event in the same request
    await recordAudit({
      actor: req.user.userId,
      tool: req.tool,
      action: 'create_record',
      recordRefs: [{ recordId, rev: 1 }],
      meta: { type, recordId }
    });

    return res.status(201).json({
      recordId: record.recordId,
      type: record.type,
      currentRevision: 1,
      readers: record.readers,
      writers: record.writers,
      content: revision.content,
      author: revision.author,
      tool: revision.tool,
      createdAt: revision.createdAt
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/records/:id - update record with optimistic concurrency (baseRevision check)
recordsRouter.put('/:id', validate(updateRecordSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, baseRevision } = req.body;

    const record = await Record.findOne({ recordId: id });
    if (!record) {
      throw notFound(`Record ${id} not found`);
    }

    // Check write permission
    if (!record.writers.includes(req.user.userId)) {
      throw forbidden(`User ${req.user.userId} does not have write permission for ${id}`);
    }

    // Optimistic concurrency check
    if (record.currentRevision !== baseRevision) {
      throw revisionConflict(
        `Revision conflict: baseRevision ${baseRevision} does not match currentRevision ${record.currentRevision}`
      );
    }

    // Atomic conditional update to prevent race conditions without transactions
    const updatedRecord = await Record.findOneAndUpdate(
      { recordId: id, currentRevision: baseRevision },
      { $inc: { currentRevision: 1 } },
      { new: true }
    );

    if (!updatedRecord) {
      throw revisionConflict(
        `Concurrent update detected on record ${id}. Expected baseRevision was ${baseRevision}`
      );
    }

    const newRev = updatedRecord.currentRevision;

    // Create immutable revision entry
    const newRevision = await Revision.create({
      recordId: id,
      rev: newRev,
      content,
      author: req.user.userId,
      tool: req.tool,
      createdAt: new Date()
    });

    // Detect and flag any dependent tasks or results as stale
    await detectAndFlagStaleTasks({
      recordId: id,
      fromRev: baseRevision,
      toRev: newRev,
      actor: req.user.userId,
      tool: req.tool
    });

    // Mandatory audit event in the same request
    await recordAudit({
      actor: req.user.userId,
      tool: req.tool,
      action: 'update_record',
      recordRefs: [{ recordId: id, rev: newRev }],
      meta: {
        fromRev: baseRevision,
        toRev: newRev
      }
    });

    return res.status(200).json({
      recordId: updatedRecord.recordId,
      type: updatedRecord.type,
      currentRevision: newRev,
      readers: updatedRecord.readers,
      writers: updatedRecord.writers,
      content: newRevision.content,
      author: newRevision.author,
      tool: newRevision.tool,
      createdAt: newRevision.createdAt,
      updatedAt: updatedRecord.updatedAt
    });
  } catch (err) {
    next(err);
  }
});
