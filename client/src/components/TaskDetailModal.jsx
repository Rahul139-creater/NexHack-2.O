import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export function TaskDetailModal({ taskId, onClose, onViewTrace, onOpenRecordRevision }) {
  const [context, setContext] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDetails() {
      try {
        setLoading(true);
        const [ctx, events] = await Promise.all([
          api.getTaskContext(taskId),
          api.getEvents({ taskId })
        ]);
        setContext(ctx);
        setTimeline(events);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [taskId]);

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <p>Loading task details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="alert-error">{error}</div>
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const { task, latestResult, citedSources } = context;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className={`status-badge ${task.status}`} style={{ marginRight: '8px' }}>
              {task.status}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{task.taskId}</span>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{task.title}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '16px 0', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Owner: </span>
            <span>{task.owner || 'None'}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Tool: </span>
            <span>{task.tool || 'None'}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Fencing Token: </span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{task.fencingToken}</span>
          </div>
        </div>

        {/* Latest Result */}
        <div className="card" style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>Latest Result</h3>
          {latestResult ? (
            <div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <span>Attempt: {latestResult.attempt}</span>
                <span>By: {latestResult.createdBy}</span>
                <span>Applied: {latestResult.applied ? 'Yes' : 'No'}</span>
              </div>
              <pre style={{
                backgroundColor: '#090d16',
                padding: '12px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap'
              }}>
                {latestResult.body}
              </pre>

              {/* Citations */}
              <div style={{ marginTop: '12px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Citations: </span>
                {latestResult.citations && latestResult.citations.length > 0 ? (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {latestResult.citations.map((c, i) => (
                      <button
                        key={i}
                        className="filter-chip"
                        style={{ cursor: 'pointer', borderColor: 'var(--accent)' }}
                        onClick={() => onOpenRecordRevision && onOpenRecordRevision(c.recordId, c.rev)}
                      >
                        🔗 {c.recordId}@{c.rev}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None</span>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No result submitted yet.</p>
          )}
        </div>

        {/* Timeline */}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>Execution Timeline</h3>
          <div className="timeline">
            {timeline.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No audit events logged.</p>
            ) : (
              timeline.map((ev, idx) => (
                <div key={idx} className="timeline-item">
                  <div className="timeline-time">
                    {new Date(ev.timestamp).toLocaleTimeString()} · {ev.actor} ({ev.tool})
                  </div>
                  <div className="timeline-action">{ev.action}</div>
                  {ev.recordRefs && ev.recordRefs.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Revisions: {ev.recordRefs.map(r => `${r.recordId}@${r.rev}`).join(', ')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          <button
            className="btn-primary"
            onClick={() => {
              onClose();
              onViewTrace(taskId);
            }}
          >
            🔍 View Full Trace Chain
          </button>
          <button className="logout-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
