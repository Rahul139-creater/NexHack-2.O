import { Router } from 'express';
import crypto from 'crypto';
import { Task } from '../models/Task.js';
import { Result } from '../models/Result.js';
import { Record } from '../models/Record.js';
import { Revision } from '../models/Revision.js';
import { generateId } from '../utils/idGenerator.js';
import { recordAudit } from '../utils/audit.js';
import { validate } from '../middleware/validate.js';
import {
  submitResultSchema,
  createTaskSchema
} from '../validators/schemas.js';
import {
  notFound,
  forbidden,
  invalidState,
  leaseLost,
  validationError
} from '../middleware/errorHandler.js';

export const tasksRouter = Router();

// GET /api/tasks - list tasks (optional ?status=)
tasksRouter.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks - create new task
tasksRouter.post('/', validate(createTaskSchema), async (req, res, next) => {
  try {
    const { title, briefRef, dependsOn } = req.body;
    const taskId = await generateId('task');

    const task = await Task.create({
      taskId,
      title,
      briefRef,
      dependsOn: dependsOn || [],
      status: 'open',
      fencingToken: 0
    });

    await recordAudit({
      actor: req.user.userId,
      tool: req.tool,
      action: 'create_task',
      taskId,
      recordRefs: [briefRef, ...(dependsOn || [])],
      meta: { title }
    });

    return res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id - task detail
tasksRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ taskId: id });
    if (!task) {
      throw notFound(`Task ${id} not found`);
    }
    return res.status(200).json(task);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/claim - claim task (allowed from open, stale, or expired claimed lease)
tasksRouter.post('/:id/claim', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingTask = await Task.findOne({ taskId: id });
    if (!existingTask) {
      throw notFound(`Task ${id} not found`);
    }

    const now = new Date();
    const isExpiredClaimed =
      existingTask.status === 'claimed' &&
      existingTask.lease?.expiresAt &&
      new Date(existingTask.lease.expiresAt) < now;

    const isClaimable =
      ['open', 'stale'].includes(existingTask.status) || isExpiredClaimed;

    if (!isClaimable) {
      throw invalidState(
        `Task ${id} is in status '${existingTask.status}' and lease has not expired. Claim is only permitted from 'open', 'stale', or an expired lease.`
      );
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const previousOwner = isExpiredClaimed ? existingTask.owner : null;

    const updatedTask = await Task.findOneAndUpdate(
      {
        taskId: id,
        $or: [
          { status: { $in: ['open', 'stale'] } },
          { status: 'claimed', 'lease.expiresAt': { $lt: now } }
        ]
      },
      {
        $set: {
          owner: req.user.userId,
          tool: req.tool,
          'lease.expiresAt': expiresAt,
          status: 'claimed'
        },
        $inc: { fencingToken: 1 }
      },
      { new: true }
    );

    if (!updatedTask) {
      throw invalidState(`Task ${id} could not be claimed; state changed concurrently`);
    }

    const action = isExpiredClaimed ? 'reclaim_expired_lease' : 'claim_task';

    await recordAudit({
      actor: req.user.userId,
      tool: req.tool,
      action,
      taskId: id,
      meta: {
        fencingToken: updatedTask.fencingToken,
        leaseExpiresAt: expiresAt,
        ...(previousOwner ? { previousOwner } : {})
      }
    });

    return res.status(200).json({
      task: updatedTask,
      fencingToken: updatedTask.fencingToken
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/result - submit task result (idempotent, checks lease/fencing)
tasksRouter.post('/:id/result', validate(submitResultSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { attempt, body, citations, fencingToken, baseRevisions } = req.body;

    const task = await Task.findOne({ taskId: id });
    if (!task) {
      throw notFound(`Task ${id} not found`);
    }

    // Fencing token and ownership validation
    if (task.fencingToken !== fencingToken || task.owner !== req.user.userId) {
      throw leaseLost(
        `Fencing token mismatch or caller is not owner of task ${id} (expected token: ${task.fencingToken}, owner: ${task.owner})`
      );
    }

    // Verify all cited records exist and user has read permission
    for (const citation of citations) {
      const record = await Record.findOne({ recordId: citation.recordId });
      if (!record) {
        throw validationError(`Cited record ${citation.recordId} does not exist`);
      }
      if (!record.readers.includes(req.user.userId)) {
        throw forbidden(`User ${req.user.userId} does not have read access to cited record ${citation.recordId}`);
      }

      const revision = await Revision.findOne({
        recordId: citation.recordId,
        rev: citation.rev
      });
      if (!revision) {
        throw validationError(`Cited revision ${citation.rev} does not exist for record ${citation.recordId}`);
      }
    }

    // Idempotency key: sha256(taskId + attempt + JSON.stringify(body))
    const bodyStr = JSON.stringify(body);
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${id}${attempt}${bodyStr}`)
      .digest('hex');

    const existingResult = await Result.findOne({ idempotencyKey });
    if (existingResult) {
      return res.status(200).json({
        result: existingResult,
        task,
        idempotent: true
      });
    }

    // Check baseRevisions against records' currentRevision
    let hasConflict = false;
    let baseList = [];
    if (Array.isArray(baseRevisions)) {
      baseList = baseRevisions;
    } else if (baseRevisions && typeof baseRevisions === 'object') {
      baseList = Object.entries(baseRevisions).map(([recordId, rev]) => ({ recordId, rev }));
    }

    for (const item of baseList) {
      const rec = await Record.findOne({ recordId: item.recordId });
      if (rec && rec.currentRevision > item.rev) {
        hasConflict = true;
        break;
      }
    }

    const targetStatus = hasConflict ? 'conflict' : 'result_saved';

    const result = await Result.create({
      taskId: id,
      attempt,
      idempotencyKey,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      citations,
      createdBy: req.user.userId,
      tool: req.tool,
      applied: false
    });

    const updatedTask = await Task.findOneAndUpdate(
      { taskId: id, status: 'claimed' },
      { status: targetStatus },
      { new: true }
    );

    await recordAudit({
      actor: req.user.userId,
      tool: req.tool,
      action: 'submit_result',
      taskId: id,
      recordRefs: citations,
      meta: {
        attempt,
        idempotencyKey,
        status: targetStatus,
        hasConflict
      }
    });

    return res.status(201).json({
      result,
      task: updatedTask || task,
      status: targetStatus
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id/context - context with exact cited revision content
tasksRouter.get('/:id/context', async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ taskId: id });
    if (!task) {
      throw notFound(`Task ${id} not found`);
    }

    const latestResult = await Result.findOne({ taskId: id }).sort({ createdAt: -1 });

    const citedSources = [];
    const citations = latestResult ? latestResult.citations : [];

    for (const citation of citations) {
      const record = await Record.findOne({ recordId: citation.recordId });
      if (!record) {
        throw notFound(`Cited record ${citation.recordId} not found`);
      }
      if (!record.readers.includes(req.user.userId)) {
        throw forbidden(`User ${req.user.userId} does not have read access to cited record ${citation.recordId}`);
      }

      // Exact cited revision, NOT currentRevision
      const revision = await Revision.findOne({
        recordId: citation.recordId,
        rev: citation.rev
      });
      if (!revision) {
        throw notFound(`Revision ${citation.rev} of record ${citation.recordId} not found`);
      }

      citedSources.push({
        recordId: citation.recordId,
        rev: citation.rev,
        content: revision.content
      });
    }

    return res.status(200).json({
      task,
      latestResult: latestResult || null,
      citedSources
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/resume - complete task whose result is saved
tasksRouter.post('/:id/resume', async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ taskId: id });
    if (!task) {
      throw notFound(`Task ${id} not found`);
    }

    // If already completed, idempotent 200 with current state and no extra audit event
    if (task.status === 'completed') {
      return res.status(200).json({
        task,
        message: 'Task already completed'
      });
    }

    if (task.status !== 'result_saved') {
      throw invalidState(
        `Cannot resume task in state '${task.status}'. Resume is only allowed from 'result_saved'.`
      );
    }

    const updatedTask = await Task.findOneAndUpdate(
      { taskId: id, status: 'result_saved' },
      { status: 'completed' },
      { new: true }
    );

    if (!updatedTask) {
      const recheck = await Task.findOne({ taskId: id });
      if (recheck && recheck.status === 'completed') {
        return res.status(200).json({
          task: recheck,
          message: 'Task already completed'
        });
      }
      throw invalidState(`Could not complete task ${id}`);
    }

    // Mark latest result applied=true
    await Result.findOneAndUpdate(
      { taskId: id, applied: false },
      { applied: true },
      { sort: { createdAt: -1 } }
    );

    // Exactly one completion audit event
    await recordAudit({
      actor: req.user.userId,
      tool: req.tool,
      action: 'complete_task',
      taskId: id,
      meta: { status: 'completed' }
    });

    return res.status(200).json({
      task: updatedTask,
      message: 'Task completed successfully'
    });
  } catch (err) {
    next(err);
  }
});
