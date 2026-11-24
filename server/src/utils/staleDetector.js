import { Task } from '../models/Task.js';
import { Result } from '../models/Result.js';
import { ReviewFlag } from '../models/ReviewFlag.js';
import { recordAudit } from './audit.js';

export async function detectAndFlagStaleTasks({
  recordId,
  fromRev,
  toRev,
  actor = 'system',
  tool = 'api'
}) {
  // 1. Find results whose citations reference older revision of this record
  const affectedResults = await Result.find({
    citations: {
      $elemMatch: {
        recordId,
        rev: { $lt: toRev }
      }
    }
  });

  const taskIdsFromResults = affectedResults.map(r => r.taskId);

  // 2. Find tasks whose briefRef or dependsOn reference an older revision,
  // or whose results cite an older revision.
  // Only target active tasks (not completed or already conflict)
  const candidateTasks = await Task.find({
    $and: [
      { status: { $in: ['open', 'claimed', 'result_saved'] } },
      {
        $or: [
          { 'briefRef.recordId': recordId, 'briefRef.rev': { $lt: toRev } },
          { dependsOn: { $elemMatch: { recordId, rev: { $lt: toRev } } } },
          { taskId: { $in: taskIdsFromResults } }
        ]
      }
    ]
  });

  const markedTasks = [];

  for (const task of candidateTasks) {
    task.status = 'stale';
    await task.save();

    await ReviewFlag.create({
      taskId: task.taskId,
      reason: `Record ${recordId} updated from rev ${fromRev} to ${toRev}`,
      changedRecord: {
        recordId,
        fromRev,
        toRev
      },
      status: 'pending'
    });

    await recordAudit({
      actor,
      tool,
      action: 'task_marked_stale',
      taskId: task.taskId,
      recordRefs: [{ recordId, rev: toRev }],
      meta: {
        reason: `Record ${recordId} updated from rev ${fromRev} to ${toRev}`,
        previousStatus: task.status
      }
    });

    markedTasks.push(task);
  }

  return markedTasks;
}
