import { Router } from 'express';
import { Task } from '../models/Task.js';
import { ReviewFlag } from '../models/ReviewFlag.js';
import { Result } from '../models/Result.js';
import { Event } from '../models/Event.js';
import { Revision } from '../models/Revision.js';
import { notFound } from '../middleware/errorHandler.js';

export const traceRouter = Router();

// GET /api/trace/:taskId - returns provenance chain for a task
traceRouter.get('/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findOne({ taskId });
    if (!task) {
      throw notFound(`Task ${taskId} not found`);
    }

    const rawFlags = await ReviewFlag.find({ taskId }).sort({ createdAt: 1 });
    const enrichedFlags = [];

    for (const flag of rawFlags) {
      const { recordId, fromRev, toRev } = flag.changedRecord;
      const fromRevision = await Revision.findOne({ recordId, rev: fromRev });
      const toRevision = await Revision.findOne({ recordId, rev: toRev });

      enrichedFlags.push({
        flag,
        changedRecord: {
          recordId,
          fromRev,
          toRev,
          fromContent: fromRevision ? fromRevision.content : '',
          toContent: toRevision ? toRevision.content : '',
          changedBy: toRevision ? toRevision.author : null
        },
        approvedBy: flag.approvedBy
      });
    }

    const results = await Result.find({ taskId }).sort({ createdAt: 1 });
    const events = await Event.find({ taskId }).sort({ timestamp: 1 });

    return res.status(200).json({
      task,
      flags: enrichedFlags,
      results,
      events
    });
  } catch (err) {
    next(err);
  }
});
