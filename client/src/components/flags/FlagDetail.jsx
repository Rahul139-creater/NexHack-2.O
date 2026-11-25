import React, { useState } from 'react';
import { api } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { DiffViewer } from './DiffViewer.jsx';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GitBranch,
  Shield,
  Clock,
  User,
  ArrowRight
} from 'lucide-react';

export function FlagDetail({ flagData, onResolved, onViewTrace }) {
  const { currentUser, activeTool } = useAuth();
  const { showToast } = useToast();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const { flag, task, changedRecord } = flagData;
  const canApprove = ['lead', 'reviewer'].includes(currentUser?.role);

  async function handleApprove() {
    setLoading(true);
    try {
      const res = await api.approveFlag(flag._id, note, activeTool);
      showToast(res.message || 'Review flag approved! Task reset to open.', 'success');
      setNote('');
      onResolved();
    } catch (err) {
      if (err.status === 403) {
        showToast(`Access Denied: Role '${currentUser.role}' cannot approve flags. Lead or Reviewer required.`, 'error');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    try {
      const res = await api.rejectFlag(flag._id, note, activeTool);
      showToast('Review flag rejected.', 'info');
      setNote('');
      onResolved();
    } catch (err) {
      if (err.status === 403) {
        showToast(`Access Denied: Role '${currentUser.role}' cannot reject flags.`, 'error');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '16px',
        marginBottom: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className={`badge badge-${flag.status === 'pending' ? 'stale' : flag.status === 'approved' ? 'completed' : 'conflict'}`}>
              Flag: {flag.status}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              Linked Task: {flag.taskId}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Detected: {new Date(flag.createdAt).toLocaleString()}
          </div>
        </div>

        <button
          className="btn btn-outline btn-sm"
          onClick={() => onViewTrace(flag.taskId)}
        >
          <GitBranch size={14} />
          <span>View Provenance</span>
        </button>
      </div>

      {/* Flag Reason Banner */}
      <div style={{
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <AlertTriangle size={20} color="#f87171" />
        <div>
          <div style={{ fontWeight: 600, color: '#fca5a5', fontSize: '0.9rem' }}>
            {flag.reason}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Record <strong>{changedRecord.recordId}</strong> was upgraded from Rev {changedRecord.fromRev} to Rev {changedRecord.toRev}.
          </div>
        </div>
      </div>

      {/* Side-by-Side Visual Diff */}
      <div style={{ marginBottom: '16px', flex: 1 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
          Decision Revision Diff (Root Cause Analysis)
        </div>
        <DiffViewer
          fromRev={changedRecord.fromRev}
          toRev={changedRecord.toRev}
          fromContent={changedRecord.fromContent}
          toContent={changedRecord.toContent}
          changedBy={changedRecord.changedBy}
        />
      </div>

      {/* Resolution & Role Gates */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '16px',
        marginTop: 'auto'
      }}>
        {flag.status === 'pending' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Reviewer Decision & Task Reset
              </span>
              <span className={`badge badge-role-${currentUser?.role}`}>
                Your Role: {currentUser?.role} {canApprove ? '(Authorized)' : '(Read Only / Forbidden)'}
              </span>
            </div>

            <input
              type="text"
              className="input-field"
              placeholder="Add review approval notes (e.g. Confirmed Argon2 protocol and approved task reset)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ marginBottom: '12px', fontSize: '0.85rem' }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleReject}
                disabled={loading}
              >
                <XCircle size={14} />
                <span>Reject Flag</span>
              </button>
              <button
                className="btn btn-success"
                onClick={handleApprove}
                disabled={loading}
              >
                <CheckCircle2 size={16} />
                <span>{loading ? 'Processing...' : 'Approve & Reset Task to OPEN'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} color="#10b981" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                Flag {flag.status.toUpperCase()} by {flag.approvedBy || 'reviewer'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                Task {flag.taskId} was reset to OPEN so agents can re-execute against the revised decision.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
