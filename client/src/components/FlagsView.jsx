import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export function FlagsView({ currentUser, onViewTrace }) {
  const [flags, setFlags] = useState([]);
  const [selectedFlagId, setSelectedFlagId] = useState(null);
  const [flagDetail, setFlagDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canApprove = ['lead', 'reviewer'].includes(currentUser.role);

  async function loadFlags() {
    try {
      setLoading(true);
      setError('');
      const data = await api.getFlags();
      // Sort pending first
      const sorted = [...data].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      setFlags(sorted);
      if (sorted.length > 0 && !selectedFlagId) {
        setSelectedFlagId(sorted[0]._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlags();
  }, []);

  useEffect(() => {
    if (!selectedFlagId) return;

    async function loadDetail() {
      try {
        setError('');
        const detail = await api.getFlag(selectedFlagId);
        setFlagDetail(detail);
      } catch (err) {
        setError(err.message);
      }
    }
    loadDetail();
  }, [selectedFlagId]);

  async function handleApprove() {
    if (!selectedFlagId) return;
    setActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.approveFlag(selectedFlagId, note);
      setSuccessMsg(`Flag approved! Task ${flagDetail?.task?.taskId || ''} has been reset to open.`);
      setNote('');
      await loadFlags();
      // reload current detail
      const detail = await api.getFlag(selectedFlagId);
      setFlagDetail(detail);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selectedFlagId) return;
    setActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.rejectFlag(selectedFlagId, note);
      setSuccessMsg('Flag marked as rejected.');
      setNote('');
      await loadFlags();
      const detail = await api.getFlag(selectedFlagId);
      setFlagDetail(detail);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function renderLineDiff(oldText = '', newText = '') {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    return (
      <div className="diff-container">
        <div className="diff-panel">
          <div className="diff-header">
            Old Revision ({flagDetail?.changedRecord?.fromRev || 'Previous'})
          </div>
          {oldLines.map((line, idx) => {
            const isRemoved = !newLines.includes(line);
            return (
              <div key={idx} className={`diff-line ${isRemoved ? 'removed' : ''}`}>
                {isRemoved ? '- ' : '  '}{line}
              </div>
            );
          })}
        </div>

        <div className="diff-panel">
          <div className="diff-header">
            New Revision ({flagDetail?.changedRecord?.toRev || 'Latest'}) · Changed by: {flagDetail?.changedRecord?.changedBy || 'system'}
          </div>
          {newLines.map((line, idx) => {
            const isAdded = !oldLines.includes(line);
            return (
              <div key={idx} className={`diff-line ${isAdded ? 'added' : ''}`}>
                {isAdded ? '+ ' : '  '}{line}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Review Flags & Stale Task Interventions</h2>
        <button className="filter-chip" onClick={loadFlags}>
          🔄 Refresh
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {successMsg && <div className="alert-info">{successMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px' }}>
        {/* Left Column: Flags list */}
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-muted)' }}>
            Review Flags ({flags.length})
          </h3>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading review flags...</p>
          ) : flags.length === 0 ? (
            <div className="empty-state">No review flags detected. All tasks are fresh!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {flags.map((f) => (
                <div
                  key={f._id}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedFlagId === f._id ? 'var(--accent)' : 'var(--border)',
                    backgroundColor: selectedFlagId === f._id ? 'rgba(56, 189, 248, 0.05)' : 'var(--bg-secondary)',
                    padding: '12px 16px',
                    marginBottom: '4px'
                  }}
                  onClick={() => setSelectedFlagId(f._id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      Task: {f.taskId}
                    </span>
                    <span className={`status-badge ${f.status}`}>{f.status}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '4px' }}>
                    {f.reason}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Record: {f.changedRecord?.recordId} (rev {f.changedRecord?.fromRev} ➔ rev {f.changedRecord?.toRev})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Diff & Action */}
        <div>
          {flagDetail ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    Intervention for Task: {flagDetail.task?.taskId || flagDetail.flag?.taskId}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Task Status: <span className={`status-badge ${flagDetail.task?.status}`}>{flagDetail.task?.status}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className={`status-badge ${flagDetail.flag?.status}`}>
                    Flag: {flagDetail.flag?.status}
                  </span>
                  {onViewTrace && (
                    <button
                      className="filter-chip"
                      onClick={() => onViewTrace(flagDetail.flag?.taskId)}
                    >
                      🔍 Trace Chain
                    </button>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '0.9rem', marginBottom: '16px', color: 'var(--text-muted)' }}>
                <strong>Reason:</strong> {flagDetail.flag?.reason}
              </div>

              {/* Side-by-Side Diff */}
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent)' }}>
                Decision Revision Diff ({flagDetail.changedRecord?.recordId})
              </h4>
              {renderLineDiff(
                flagDetail.changedRecord?.fromContent,
                flagDetail.changedRecord?.toContent
              )}

              {/* Action Controls for lead or reviewer */}
              {flagDetail.flag?.status === 'pending' ? (
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  {canApprove ? (
                    <div>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                        Reviewer Action (Approve and reset task to open)
                      </h4>
                      <input
                        type="text"
                        placeholder="Optional approval/rejection note..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        style={{ width: '100%', marginBottom: '12px' }}
                      />
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          className="btn-success"
                          onClick={handleApprove}
                          disabled={actionLoading}
                        >
                          {actionLoading ? 'Processing...' : '✓ Approve & Reset Task to Open'}
                        </button>
                        <button
                          className="btn-danger"
                          onClick={handleReject}
                          disabled={actionLoading}
                        >
                          {actionLoading ? 'Processing...' : '✕ Reject'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-info" style={{ margin: 0 }}>
                      ℹ️ Your current role is <strong>{currentUser.role}</strong>. Only <strong>lead</strong> or <strong>reviewer</strong> roles can approve review flags.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Processed by: <strong>{flagDetail.flag?.approvedBy || 'Unknown'}</strong> on {new Date(flagDetail.flag?.updatedAt).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">Select a review flag to view the revision diff.</div>
          )}
        </div>
      </div>
    </div>
  );
}
