import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

export function RecordsView({ initialRecordId, initialRev }) {
  const [records, setRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState(initialRecordId || null);
  const [activeRecord, setActiveRecord] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [selectedRev, setSelectedRev] = useState(initialRev || null);
  const [revDetail, setRevDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load readable records
  async function loadRecords() {
    try {
      setLoading(true);
      setError('');
      const data = await api.getRecords();
      setRecords(data);
      if (!selectedRecordId && data.length > 0) {
        setSelectedRecordId(data[0].recordId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  // When selectedRecordId changes, load record and its revisions
  useEffect(() => {
    if (!selectedRecordId) return;

    async function loadRecordData() {
      try {
        setError('');
        const [rec, revList] = await Promise.all([
          api.getRecord(selectedRecordId),
          api.getRecordRevisions(selectedRecordId)
        ]);
        setActiveRecord(rec);
        setRevisions(revList);

        // If specific revision was requested or latest
        const targetRev = selectedRev || rec.currentRevision;
        setSelectedRev(targetRev);
      } catch (err) {
        setError(err.message);
      }
    }
    loadRecordData();
  }, [selectedRecordId]);

  // When selectedRev changes, load that revision's content
  useEffect(() => {
    if (!selectedRecordId || !selectedRev) return;

    async function loadRevision() {
      try {
        const data = await api.getRecordRevision(selectedRecordId, selectedRev);
        setRevDetail(data);
      } catch (err) {
        setError(err.message);
      }
    }
    loadRevision();
  }, [selectedRecordId, selectedRev]);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Team Records</h2>
        <button className="filter-chip" onClick={loadRecords}>
          🔄 Refresh
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
        {/* Left Column: Records List */}
        <div>
          <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-muted)' }}>
            Readable Records ({records.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {records.map((r) => (
              <div
                key={r.recordId}
                className="card"
                style={{
                  cursor: 'pointer',
                  borderColor: selectedRecordId === r.recordId ? 'var(--accent)' : 'var(--border)',
                  backgroundColor: selectedRecordId === r.recordId ? 'rgba(56, 189, 248, 0.05)' : 'var(--bg-secondary)',
                  padding: '12px 16px',
                  marginBottom: '4px'
                }}
                onClick={() => {
                  setSelectedRecordId(r.recordId);
                  setSelectedRev(null);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>
                    {r.recordId}
                  </span>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    rev {r.currentRevision}
                  </span>
                </div>
                <div style={{ fontWeight: 500, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.title || r.type}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Record Detail & Historical Revisions */}
        <div>
          {activeRecord ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{activeRecord.recordId}</h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Type: <span style={{ textTransform: 'capitalize' }}>{activeRecord.type}</span> · Current Revision: {activeRecord.currentRevision}
                  </div>
                </div>

                {/* Revision Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Viewing:</span>
                  <select
                    value={selectedRev || activeRecord.currentRevision}
                    onChange={(e) => setSelectedRev(parseInt(e.target.value, 10))}
                  >
                    {revisions.map((rev) => (
                      <option key={rev.rev} value={rev.rev}>
                        Revision {rev.rev} ({rev.author} · {rev.tool})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Revision Metadata */}
              {revDetail && (
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginBottom: '12px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px'
                }}>
                  <span>Author: <strong style={{ color: 'var(--text-main)' }}>{revDetail.author}</strong></span>
                  <span>Tool: <strong style={{ color: 'var(--text-main)' }}>{revDetail.tool}</strong></span>
                  <span>Created: {new Date(revDetail.createdAt).toLocaleString()}</span>
                </div>
              )}

              {/* Content Box */}
              <div style={{ marginTop: '16px' }}>
                <pre style={{
                  backgroundColor: '#090d16',
                  padding: '16px',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6'
                }}>
                  {revDetail ? revDetail.content : activeRecord.content}
                </pre>
              </div>

              {/* Access Lists */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div>
                  <strong>Readers:</strong> {activeRecord.readers ? activeRecord.readers.join(', ') : 'None'}
                </div>
                <div>
                  <strong>Writers:</strong> {activeRecord.writers ? activeRecord.writers.join(', ') : 'None'}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">Select a record to inspect its contents and revisions.</div>
          )}
        </div>
      </div>
    </div>
  );
}
