import { Event } from '../models/Event.js';

export async function recordAudit({
  actor,
  tool = 'api',
  action,
  taskId = null,
  recordRefs = [],
  meta = {}
}) {
  return await Event.create({
    actor,
    tool,
    action,
    taskId,
    recordRefs,
    meta,
    timestamp: new Date()
  });
}
