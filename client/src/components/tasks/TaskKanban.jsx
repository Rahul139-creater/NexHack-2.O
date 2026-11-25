import React from 'react';
import {
  Clock,
  User,
  Cpu,
  Layers,
  Shield,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  FileCode
} from 'lucide-react';

export function TaskKanban({ tasks, onSelectTask, onClaimTask, onResumeTask }) {
  const columns = [
    {
      id: 'open',
      title: 'Open Tasks',
      filter: (t) => t.status === 'open',
      badgeClass: 'badge-open',
      emptyText: 'No open tasks'
    },
    {
      id: 'claimed',
      title: 'Claimed (Lease Active)',
      filter: (t) => t.status === 'claimed',
      badgeClass: 'badge-claimed',
      emptyText: 'No active agent claims'
    },
    {
      id: 'result_saved',
      title: 'Result Saved',
      filter: (t) => t.status === 'result_saved',
      badgeClass: 'badge-result_saved',
      emptyText: 'No pending handoffs'
    },
    {
      id: 'stale',
      title: 'Stale / Intervened',
      filter: (t) => ['stale', 'conflict'].includes(t.status),
      badgeClass: 'badge-stale',
      emptyText: 'No stale tasks'
    },
    {
      id: 'completed',
      title: 'Completed',
      filter: (t) => t.status === 'completed',
      badgeClass: 'badge-completed',
      emptyText: 'No completed tasks'
    }
  ];

  return (
    <div className="kanban-board">
      {columns.map((col) => {
        const colTasks = tasks.filter(col.filter);
        return (
          <div key={col.id} className="kanban-col">
            <div className="kanban-col-header">
              <div className="kanban-col-title">
                <span>{col.title}</span>
                <span className={`badge ${col.badgeClass}`}>{colTasks.length}</span>
              </div>
            </div>

            <div className="kanban-cards-wrapper">
              {colTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                  {col.emptyText}
                </div>
              ) : (
                colTasks.map((task) => (
                  <div
                    key={task.taskId}
                    className="kanban-card"
                    onClick={() => onSelectTask(task.taskId)}
                    style={{
                      borderLeft: task.status === 'stale'
                        ? '3px solid #ef4444'
                        : task.status === 'result_saved'
                        ? '3px solid #818cf8'
                        : '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                        {task.taskId}
                      </span>
                      <span className={`badge badge-${task.status}`}>{task.status}</span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '10px', lineHeight: 1.4 }}>
                      {task.title}
                    </div>

                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '8px'
                    }}>
                      {task.owner && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} />
                          {task.owner}
                        </span>
                      )}

                      {task.tool && (
                        <span className="badge badge-tool" style={{ fontSize: '0.65rem' }}>
                          {task.tool}
                        </span>
                      )}

                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                        Fencing: #{task.fencingToken}
                      </span>
                    </div>

                    {/* Quick action buttons right on the card */}
                    <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                      {['open', 'stale'].includes(task.status) && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ width: '100%', fontSize: '0.75rem' }}
                          onClick={() => onClaimTask(task)}
                        >
                          <Cpu size={12} />
                          <span>Claim Task</span>
                        </button>
                      )}

                      {task.status === 'result_saved' && (
                        <button
                          className="btn btn-success btn-sm"
                          style={{ width: '100%', fontSize: '0.75rem' }}
                          onClick={() => onResumeTask(task.taskId)}
                        >
                          <CheckCircle2 size={12} />
                          <span>Resume & Land</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
