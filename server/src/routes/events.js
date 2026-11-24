import { Router } from 'express';
import { Event } from '../models/Event.js';

export const eventsRouter = Router();

// GET /api/events - audit trail sorted by time (optional ?taskId=, ?recordId=)
eventsRouter.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.taskId) {
      filter.taskId = req.query.taskId;
    }
    if (req.query.recordId) {
      filter['recordRefs.recordId'] = req.query.recordId;
    }

    const events = await Event.find(filter).sort({ timestamp: 1 });
    return res.status(200).json(events);
  } catch (err) {
    next(err);
  }
});
