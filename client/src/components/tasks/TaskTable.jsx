import React from 'react';
import { User, Cpu, ExternalLink, GitBranch } from 'lucide-react';

export function TaskTable({ tasks, onSelectTask, onViewTrace }) {
  return (
    <div className="table-container">
      <table className="modern-table">
        <thead>
          <tr>
            <th>Task ID</th>
            <th>Title & Objective</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Agent Tool</th>
            <th>Fencing Token</th>
            <th>Brief Reference</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr
              key={task.taskId}
              className="clickable-row"
              onClick={() => onSelectTask(task.taskId)}
            >
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {task.taskId}
              </td>
              <td style={{ fontWeight: 500, maxWidth: '300px' }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {task.title}
                </div>
              </td>
              <td>
                <span className={`badge badge-${task.status}`}>{task.status}</span>
              </td>
              <td>
                {task.owner ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <User size={13} color="var(--text-dim)" />
                    {task.owner}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-dim)' }}>—</span>
                )}
              </td>
              <td>
                {task.tool ? (
                  <span className="badge badge-tool">{task.tool}</span>
                ) : (
                  <span style={{ color: 'var(--text-dim)' }}>—</span>
                )}
              </td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>#{task.fencingToken}</td>
              <td style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                {task.briefRef ? `${task.briefRef.recordId}@${task.briefRef.rev}` : '—'}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => onSelectTask(task.taskId)}
                  >
                    Details
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onViewTrace(task.taskId)}
                    title="View Provenance Trace"
                  >
                    <GitBranch size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
