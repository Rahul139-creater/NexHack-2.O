import { Router } from 'express';
import mongoose from 'mongoose';
import { ReviewFlag } from '../models/ReviewFlag.js';
import { Task } from '../models/Task.js';
import { Record } from '../models/Record.js';
import { Revision } from '../models/Revision.js';
import { recordAudit } from '../utils/audit.js';
import {
  notFound,
  forbidden,
  invalidState
} from '../middleware/errorHandler.js';

export const flagsRouter = Router();

function getFlagFilter(id) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { _id: id };
  }
  return { flagId: id };
}

// GET /api/flags - list review flags (optional ?status=)
flagsRouter.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const flags = await ReviewFlag.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(flags);
  } catch (err) {
    next(err);
  }
});

// GET /api/flags/:id - diff view with old and new revision contents
flagsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const flag = await ReviewFlag.findOne(getFlagFilter(id));
    if (!flag) {
      throw notFound(`Review flag ${id} not found`);
    }

    const { recordId, fromRev, toRev } = flag.changedRecord;

    // Enforce read permission on changed record
    const record = await Record.findOne({ recordId });
    if (!record) {
      throw notFound(`Record ${recordId} not found`);
    }
    if (!record.readers.includes(req.user.userId)) {
      throw forbidden(`User ${req.user.userId} does not have read access to record ${recordId}`);
    }

    const task = await Task.findOne({ taskId: flag.taskId });

    const fromRevision = await Revision.findOne({ recordId, rev: fromRev });
    const toRevision = await Revision.findOne({ recordId, rev: toRev });

    return res.status(200).json({
      flag,
      task: task || null,
      changedRecord: {
        recordId,
        fromRev,
        toRev,
        fromContent: fromRevision ? fromRevision.content : '',
        toContent: toRevision ? toRevision.content : '',
        changedBy: toRevision ? toRevision.author : null
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/flags/:id/approve - approve flag (lead or reviewer only)
flagsRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Role check: lead or reviewer only
    if (!['lead', 'reviewer'].includes(req.user.role)) {
      throw forbidden(`User with role '${req.user.role}' cannot approve review flags. Requires lead or reviewer.`);
    }

    const flag = await ReviewFlag.findOne(getFlagFilter(id));
    if (!flag) {
      throw notFound(`Review flag ${id} not found`);
    }

    if (flag.status !== 'pending') {
      throw invalidState(`Review flag ${id} is already in '${flag.status}' state.`);
    }

    // Atomic conditional transition on status pending
    const updatedFlag = await ReviewFlag.findOneAndUpdate(
      { _id: flag._id, status: 'pending' },
      {
        $set: {
          status: 'approved',
          approvedBy: req.user.userId
        }
      },
      { new: true }
    );

    if (!updatedFlag) {
      throw invalidState(`Review flag ${id} was already processed concurrently.`);
    }

    // Move linked task from stale (or conflict) back to open
    await Task.findOneAndUpdate(
      { taskId: updatedFlag.taskId, status: { $in: ['stale', 'conflict'] } },
      { $set: { status: 'open' } }
    );

    // Exactly one audit event
    await recordAudit({
      actor: req.user.userId,
      tool: req.user.tool || 'api',
      action: 'approve_review_flag',
      taskId: updatedFlag.taskId,
      meta: {
        flagId: updatedFlag._id.toString(),
        note: req.body?.note || null
      }
    });

    return res.status(200).json({
      flag: updatedFlag,
      message: 'Review flag approved and task reset to open'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/flags/:id/reject - reject flag (lead or reviewer only)
flagsRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!['lead', 'reviewer'].includes(req.user.role)) {
      throw forbidden(`User with role '${req.user.role}' cannot reject review flags. Requires lead or reviewer.`);
    }

    const flag = await ReviewFlag.findOne(getFlagFilter(id));
    if (!flag) {
      throw notFound(`Review flag ${id} not found`);
    }

    if (flag.status !== 'pending') {
      throw invalidState(`Review flag ${id} is already in '${flag.status}' state.`);
    }

    const updatedFlag = await ReviewFlag.findOneAndUpdate(
      { _id: flag._id, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          approvedBy: req.user.userId
        }
      },
      { new: true }
    );

    if (!updatedFlag) {
      throw invalidState(`Review flag ${id} was already processed concurrently.`);
    }

    await recordAudit({
      actor: req.user.userId,
      tool: req.user.tool || 'api',
      action: 'reject_review_flag',
      taskId: updatedFlag.taskId,
      meta: {
        flagId: updatedFlag._id.toString(),
        note: req.body?.note || null
      }
    });

    return res.status(200).json({
      flag: updatedFlag,
      message: 'Review flag rejected'
    });
  } catch (err) {
    next(err);
  }
});
