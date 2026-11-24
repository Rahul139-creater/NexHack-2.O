import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export function AuditView() {
  const [events, setEvents] = useState([]);
  const [taskIdFilter, setTaskIdFilter] = useState('');
  const [recordIdFilter, setRecordIdFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadEvents() {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (taskIdFilter.trim()) params.taskId = taskIdFilter.trim();
      if (recordIdFilter.trim()) params.recordId = recordIdFilter.trim();

      const data = await api.getEvents(params);
      // Newest first
      const sorted = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setEvents(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Immutable Audit Trail</h2>
        <button className="filter-chip" onClick={loadEvents}>
          🔄 Refresh
        </button>
      </div>

      {/* Filter Controls */}
      <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filter by Task ID:</label>
          <input
            type="text"
            placeholder="e.g. TSK-001"
            value={taskIdFilter}
            onChange={(e) => setTaskIdFilter(e.target.value)}
            style={{ width: '160px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filter by Record ID:</label>
          <input
            type="text"
            placeholder="e.g. DEC-001"
            value={recordIdFilter}
            onChange={(e) => setRecordIdFilter(e.target.value)}
            style={{ width: '160px' }}
          />
        </div>

        <button className="btn-primary" onClick={loadEvents}>
          Apply Filters
        </button>
        {(taskIdFilter || recordIdFilter) && (
          <button
            className="logout-btn"
            onClick={() => {
              setTaskIdFilter('');
              setRecordIdFilter('');
              setTimeout(loadEvents, 0);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading audit events...</p>
      ) : events.length === 0 ? (
        <div className="empty-state">No audit events match the filter.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Tool</th>
                <th>Action</th>
                <th>Task ID</th>
                <th>Record References</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev, idx) => (
                <tr key={idx}>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(ev.timestamp).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 600 }}>{ev.actor}</td>
                  <td>
                    <span className="filter-chip" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                      {ev.tool}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{ev.action}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{ev.taskId || '—'}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {ev.recordRefs && ev.recordRefs.length > 0 ? (
                      ev.recordRefs.map((r, i) => (
                        <span key={i} style={{ marginRight: '6px' }}>
                          {r.recordId}@{r.rev}
                        </span>
                      ))
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.meta && Object.keys(ev.meta).length > 0 ? JSON.stringify(ev.meta) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
