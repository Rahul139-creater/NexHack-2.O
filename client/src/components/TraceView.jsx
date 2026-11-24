import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export function TraceView({ initialTaskId }) {
  const [taskIdInput, setTaskIdInput] = useState(initialTaskId || 'TSK-001');
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadTrace(id) {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const data = await api.getTrace(id);
      setTraceData(data);
    } catch (err) {
      setError(err.message);
      setTraceData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialTaskId) {
      setTaskIdInput(initialTaskId);
      loadTrace(initialTaskId);
    }
  }, [initialTaskId]);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Task Provenance & Corrective Trace</h2>
      </div>

      <div className="card" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
        <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Trace Task ID:</label>
        <input
          type="text"
          placeholder="e.g. TSK-001"
          value={taskIdInput}
          onChange={(e) => setTaskIdInput(e.target.value)}
          style={{ width: '220px' }}
        />
        <button className="btn-primary" onClick={() => loadTrace(taskIdInput)} disabled={loading}>
          {loading ? 'Tracing...' : 'Run Trace'}
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {traceData && (
        <div className="trace-chain">
          {/* STEP 1: Task State */}
          <div className="trace-node">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)' }}>
                Step 1: Task State
              </span>
              <span className={`status-badge ${traceData.task.status}`}>{traceData.task.status}</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{traceData.task.title}</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Task ID: <strong style={{ color: 'var(--text-main)' }}>{traceData.task.taskId}</strong> · Owner: {traceData.task.owner || 'None'} · Fencing Token: {traceData.task.fencingToken}
            </div>
          </div>

          <div className="trace-connector">⬇</div>

          {/* STEP 2: Stale Detection & Review Flag */}
          <div className="trace-node step-flag">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--danger)' }}>
              Step 2: Stale Dependency Flagged
            </span>
            {traceData.flags && traceData.flags.length > 0 ? (
              traceData.flags.map((item, idx) => (
                <div key={idx} style={{ marginTop: '8px' }}>
                  <div style={{ fontWeight: 600 }}>{item.flag.reason}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Flag ID: {item.flag._id} · Status: <strong style={{ color: 'var(--text-main)' }}>{item.flag.status}</strong>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                No review flags created for this task.
              </div>
            )}
          </div>

          <div className="trace-connector">⬇</div>

          {/* STEP 3: Changed Decision Revision */}
          <div className="trace-node step-decision">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--warning)' }}>
              Step 3: Root Cause Decision Revision
            </span>
            {traceData.flags && traceData.flags.length > 0 ? (
              traceData.flags.map((item, idx) => (
                <div key={idx} style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                    Record <strong>{item.changedRecord.recordId}</strong> was revised from rev <strong>{item.changedRecord.fromRev}</strong> to rev <strong>{item.changedRecord.toRev}</strong> by teammate <strong>{item.changedRecord.changedBy || 'teammate'}</strong>
                  </div>
                  <div className="diff-container" style={{ margin: 0 }}>
                    <div className="diff-panel">
                      <div className="diff-header">Rev {item.changedRecord.fromRev} Content</div>
                      <pre style={{ margin: 0 }}>{item.changedRecord.fromContent}</pre>
                    </div>
                    <div className="diff-panel">
                      <div className="diff-header">Rev {item.changedRecord.toRev} Content</div>
                      <pre style={{ margin: 0 }}>{item.changedRecord.toContent}</pre>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                No decision revision triggered this task.
              </div>
            )}
          </div>

          <div className="trace-connector">⬇</div>

          {/* STEP 4: Human Review & Approval */}
          <div className="trace-node step-approval">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--success)' }}>
              Step 4: Reviewer Resolution
            </span>
            {traceData.flags && traceData.flags.length > 0 && traceData.flags[0].flag.status === 'approved' ? (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>
                  ✓ Approved by teammate: <strong>{traceData.flags[0].approvedBy}</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Approved on: {new Date(traceData.flags[0].flag.updatedAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Pending approval or no intervention required.
              </div>
            )}
          </div>

          <div className="trace-connector">⬇</div>

          {/* STEP 5: Results History */}
          <div className="trace-node">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--purple)' }}>
              Step 5: Results History ({traceData.results ? traceData.results.length : 0})
            </span>
            {traceData.results && traceData.results.length > 0 ? (
              traceData.results.map((res, idx) => (
                <div key={idx} style={{ marginTop: '8px', padding: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Attempt {res.attempt} · Author: {res.createdBy} ({res.tool})</span>
                    <span>Applied: {res.applied ? 'Yes' : 'No'}</span>
                  </div>
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                    {res.body}
                  </pre>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                No results submitted yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
