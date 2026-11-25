import React, { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  Activity,
  RefreshCw,
  Search,
  Filter,
  User,
  Cpu,
  Clock,
  Layers,
  FileText,
  Code,
  X
} from 'lucide-react';

export function AuditView() {
  const { showToast } = useToast();
  const [events, setEvents] = useState([]);
  const [taskIdFilter, setTaskIdFilter] = useState('');
  const [recordIdFilter, setRecordIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [toolFilter, setToolFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  async function loadEvents() {
    setLoading(true);
    try {
      const params = {};
      if (taskIdFilter.trim()) params.taskId = taskIdFilter.trim();
      if (recordIdFilter.trim()) params.recordId = recordIdFilter.trim();

      const data = await api.getEvents(params);
      // Newest first
      const sorted = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setEvents(sorted);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = events.filter((ev) => {
    if (actionFilter && ev.action !== actionFilter) return false;
    if (toolFilter && ev.tool !== toolFilter) return false;
    return true;
  });

  const uniqueActions = [...new Set(events.map(e => e.action))];
  const uniqueTools = [...new Set(events.map(e => e.tool))];

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={22} color="var(--accent-purple)" />
            <span>Immutable Multi-Agent Audit Trail</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Append-only cryptographic record of every mutating task claim, decision change, agent result submission, and reviewer resolution.
          </p>
        </div>

        <button className="btn btn-outline btn-sm" onClick={loadEvents}>
          <RefreshCw size={14} />
          <span>Refresh Audit Stream</span>
        </button>
      </div>

      {/* Filter Controls Card */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
          <div>
            <label className="form-label">Task ID Filter</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. TSK-001"
              value={taskIdFilter}
              onChange={(e) => setTaskIdFilter(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="form-label">Record ID Filter</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. DEC-001"
              value={recordIdFilter}
              onChange={(e) => setRecordIdFilter(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="form-label">Filter Action</label>
            <select
              className="select-field"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions ({uniqueActions.length})</option>
              {uniqueActions.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Filter Tool</label>
            <select
              className="select-field"
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
            >
              <option value="">All Tools ({uniqueTools.length})</option>
              {uniqueTools.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={loadEvents}>
              <Filter size={14} />
              <span>Apply</span>
            </button>
            {(taskIdFilter || recordIdFilter || actionFilter || toolFilter) && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setTaskIdFilter('');
                  setRecordIdFilter('');
                  setActionFilter('');
                  setToolFilter('');
                  setTimeout(loadEvents, 0);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Events Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <p>Loading immutable audit events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-dim)' }}>
          <Activity size={32} style={{ marginBottom: '8px' }} />
          <div>No audit events found matching the active filters.</div>
        </div>
      ) : (
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor Identity</th>
                <th>Tool Adapter</th>
                <th>Action Performed</th>
                <th>Task ID</th>
                <th>Record References</th>
                <th>Metadata Payload</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((ev, idx) => (
                <tr
                  key={idx}
                  className="clickable-row"
                  onClick={() => setSelectedEvent(ev)}
                >
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{ev.actor}</span>
                  </td>
                  <td>
                    <span className="badge badge-tool">{ev.tool}</span>
                  </td>
                  <td>
                    <span style={{
                      fontWeight: 600,
                      color: ev.action.includes('stale')
                        ? '#f87171'
                        : ev.action.includes('complete')
                        ? '#34d399'
                        : 'var(--accent-cyan)'
                    }}>
                      {ev.action}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    {ev.taskId ? (
                      <span style={{ color: 'var(--accent-cyan)' }}>{ev.taskId}</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                    {ev.recordRefs && ev.recordRefs.length > 0 ? (
                      ev.recordRefs.map((r, i) => (
                        <span
                          key={i}
                          className="badge badge-outline"
                          style={{ marginRight: '4px', background: 'rgba(255,255,255,0.04)' }}
                        >
                          {r.recordId}@{r.rev}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>—</span>
                    )}
                  </td>
                  <td style={{ maxWidth: '240px' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {ev.meta && Object.keys(ev.meta).length > 0 ? JSON.stringify(ev.meta) : '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Metadata Detail Inspector Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={18} color="var(--accent-purple)" />
                <h3 style={{ fontSize: '1.05rem' }}>Audit Event Payload Inspector</h3>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedEvent(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.82rem'
              }}>
                <div><span style={{ color: 'var(--text-dim)' }}>Actor:</span> <strong>{selectedEvent.actor}</strong></div>
                <div><span style={{ color: 'var(--text-dim)' }}>Tool:</span> <strong>{selectedEvent.tool}</strong></div>
                <div><span style={{ color: 'var(--text-dim)' }}>Action:</span> <strong>{selectedEvent.action}</strong></div>
                <div><span style={{ color: 'var(--text-dim)' }}>Task:</span> <strong>{selectedEvent.taskId || 'None'}</strong></div>
              </div>

              <div className="form-group">
                <label className="form-label">Full Raw Audit Event JSON</label>
                <pre style={{
                  background: '#070b14',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  padding: '14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  lineHeight: '1.5',
                  color: '#e2e8f0',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedEvent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
