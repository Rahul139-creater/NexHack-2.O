import React, { useState } from 'react';
import { api } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { X, AlertTriangle, ShieldCheck, GitCommit } from 'lucide-react';

export function EditRecordModal({ record, currentRevisionDetail, onClose, onSuccess }) {
  const { currentUser, activeTool } = useAuth();
  const { showToast } = useToast();
  const [content, setContent] = useState(currentRevisionDetail?.content || '');
  const [baseRevision, setBaseRevision] = useState(record.currentRevision);
  const [loading, setLoading] = useState(false);

  async function handleUpdate(e) {
    e.preventDefault();
    if (!content.trim()) {
      showToast('Please provide revised content', 'error');
      return;
    }

    setLoading(true);
    try {
      const updated = await api.updateRecord(record.recordId, {
        content: content.trim(),
        baseRevision: parseInt(baseRevision, 10)
      }, activeTool);

      showToast(`Record ${record.recordId} revised to Rev ${updated.currentRevision}! Any dependent tasks flagged.`, 'success');
      onSuccess(updated);
      onClose();
    } catch (err) {
      if (err.status === 403) {
        showToast(`Permission Denied: User ${currentUser.userId} lacks write permission for ${record.recordId}`, 'error');
      } else if (err.status === 409) {
        showToast(`Revision Conflict: Base revision ${baseRevision} is outdated. Someone else updated this record!`, 'error');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  const isWriter = record.writers?.includes(currentUser?.userId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitCommit size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.1rem' }}>Revise Record: {record.recordId} (Create Rev {record.currentRevision + 1})</h3>
          </div>
          <button className="btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleUpdate}>
          <div className="modal-body">
            {!isWriter && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={18} color="#ef4444" />
                <span>
                  Notice: Your current user (<strong>{currentUser?.userId}</strong>) is not in the writers ACL: <strong>[{record.writers?.join(', ')}]</strong>. Submitting will test and demonstrate the 403 Forbidden RBAC gate.
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label">Base Revision (Optimistic Concurrency)</label>
                <input
                  type="number"
                  className="input-field"
                  value={baseRevision}
                  onChange={(e) => setBaseRevision(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  Must match currentRevision ({record.currentRevision}) to prevent lost updates.
                </span>
              </div>

              <div>
                <label className="form-label">Author Identity</label>
                <div className="input-field" style={{ opacity: 0.8, background: 'rgba(0,0,0,0.3)' }}>
                  {currentUser?.name} ({currentUser?.userId}) · Tool: {activeTool}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Revised Content (Markdown)</label>
              <textarea
                className="textarea-field"
                style={{ minHeight: '180px', fontFamily: 'var(--font-mono)' }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.8rem',
              color: '#fcd34d'
            }}>
              ⚡ <strong>Automatic Stale Interception Trigger:</strong> When you commit this revision, any tasks or results citing older revisions (e.g. rev {record.currentRevision}) will be automatically flagged as <strong>stale</strong>, preserving independent work while enforcing team review!
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Publishing Revision...' : `Commit Revision ${record.currentRevision + 1}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
