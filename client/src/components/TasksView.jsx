import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { TaskDetailModal } from './TaskDetailModal.jsx';

export function TasksView({ onViewTrace, onOpenRecordRevision }) {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const statuses = [
    { label: 'All', value: '' },
    { label: 'Open', value: 'open' },
    { label: 'Claimed', value: 'claimed' },
    { label: 'Result Saved', value: 'result_saved' },
    { label: 'Completed', value: 'completed' },
    { label: 'Stale', value: 'stale' },
    { label: 'Conflict', value: 'conflict' }
  ];

  async function loadTasks(status) {
    try {
      setLoading(true);
      setError('');
      const data = await api.getTasks(status);
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks(statusFilter);
  }, [statusFilter]);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Tasks Board</h2>
        <button className="filter-chip" onClick={() => loadTasks(statusFilter)}>
          🔄 Refresh
        </button>
      </div>

      {/* Filter Chips */}
      <div className="filter-bar">
        {statuses.map((st) => (
          <button
            key={st.value}
            className={`filter-chip ${statusFilter === st.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(st.value)}
          >
            {st.label}
          </button>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="empty-state">No tasks found.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Tool</th>
                <th>Fencing</th>
                <th>Brief</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.taskId}
                  className="clickable-row"
                  onClick={() => setSelectedTaskId(task.taskId)}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{task.taskId}</td>
                  <td style={{ fontWeight: 500 }}>{task.title}</td>
                  <td>
                    <span className={`status-badge ${task.status}`}>{task.status}</span>
                  </td>
                  <td>{task.owner || '—'}</td>
                  <td>{task.tool || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{task.fencingToken}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {task.briefRef ? `${task.briefRef.recordId}@${task.briefRef.rev}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onViewTrace={onViewTrace}
          onOpenRecordRevision={onOpenRecordRevision}
        />
      )}
    </div>
  );
}
