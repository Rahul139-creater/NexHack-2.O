import React, { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  FileText,
  Clock,
  User,
  Cpu,
  Edit3,
  Copy,
  History,
  Shield,
  Lock,
  GitCommit
} from 'lucide-react';

export function RecordDetail({ record, initialRev, onEditRecord, onReload }) {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [revisions, setRevisions] = useState([]);
  const [selectedRev, setSelectedRev] = useState(initialRev || record.currentRevision);
  const [revDetail, setRevDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadRevs() {
      try {
        const revList = await api.getRecordRevisions(record.recordId);
        setRevisions(revList);
        const targetRev = initialRev || record.currentRevision;
        setSelectedRev(targetRev);
      } catch (e) {
        // quiet
      }
    }
    loadRevs();
  }, [record.recordId, record.currentRevision, initialRev]);

  useEffect(() => {
    if (!selectedRev) return;
    async function loadRevDetail() {
      setLoading(true);
      try {
        const data = await api.getRecordRevision(record.recordId, selectedRev);
        setRevDetail(data);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    loadRevDetail();
  }, [record.recordId, selectedRev]);

  function copyId() {
    navigator.clipboard.writeText(record.recordId);
    showToast(`Copied ${record.recordId} to clipboard`, 'info');
  }

  const isWriter = record.writers?.includes(currentUser?.userId);

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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {record.recordId}
            </span>
            <button className="btn-ghost btn-sm" onClick={copyId} title="Copy ID">
              <Copy size={14} />
            </button>
            <span className="badge badge-tool" style={{ textTransform: 'capitalize' }}>
              {record.type}
            </span>
            <span className="badge badge-open">
              Latest: Rev {record.currentRevision}
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Updated: {new Date(record.updatedAt).toLocaleString()}
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => onEditRecord(record, revDetail)}
        >
          <Edit3 size={16} />
          <span>Revise Record (v{record.currentRevision + 1})</span>
        </button>
      </div>

      {/* ACL Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        background: 'rgba(15, 23, 42, 0.5)',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        marginBottom: '16px',
        fontSize: '0.8rem'
      }}>
        <div>
          <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
            Readers ACL (Read Permissions)
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {record.readers?.map(r => (
              <span key={r} className="badge badge-role-dev" style={{ fontSize: '0.72rem' }}>
                {r}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
            Writers ACL (Write Permissions)
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {record.writers?.map(w => (
              <span key={w} className="badge badge-role-lead" style={{ fontSize: '0.72rem' }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Revision History Switcher */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Immutable Revision Timeline ({revisions.length} revisions)
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Viewing: Revision {selectedRev}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
          {revisions.map((rev) => (
            <button
              key={rev.rev}
              className={`btn btn-sm ${selectedRev === rev.rev ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSelectedRev(rev.rev)}
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              <GitCommit size={12} />
              <span>Rev {rev.rev}</span>
              <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>({rev.author})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Revision Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
            Loading revision content...
          </div>
        ) : revDetail ? (
          <div style={{
            background: '#070b14',
            border: '1px solid var(--border-medium)',
            borderRadius: '10px',
            padding: '16px',
            flex: 1,
            overflowY: 'auto',
            maxHeight: '420px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '8px',
              marginBottom: '12px'
            }}>
              <span>Committed by: <strong>{revDetail.author}</strong> ({revDetail.tool})</span>
              <span>Timestamp: {new Date(revDetail.createdAt).toLocaleString()}</span>
            </div>

            <pre style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap'
            }}>
              {revDetail.content}
            </pre>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
            No revision content found.
          </div>
        )}
      </div>
    </div>
  );
}
