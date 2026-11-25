import React, { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { RecordDetail } from './RecordDetail.jsx';
import { CreateRecordModal } from './CreateRecordModal.jsx';
import { EditRecordModal } from './EditRecordModal.jsx';
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  BookOpen
} from 'lucide-react';

export function RecordsView({ initialRecordId, initialRev }) {
  const { showToast } = useToast();
  const [records, setRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState(initialRecordId || null);
  const [activeRecord, setActiveRecord] = useState(null);
  const [activeRev, setActiveRev] = useState(initialRev || null);
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTargetRecord, setEditTargetRecord] = useState(null);

  async function loadRecords() {
    setLoading(true);
    try {
      const data = await api.getRecords();
      setRecords(data);
      if (!selectedRecordId && data.length > 0) {
        setSelectedRecordId(data[0].recordId);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    if (!selectedRecordId) return;
    async function loadActiveRecord() {
      try {
        const full = await api.getRecord(selectedRecordId);
        setActiveRecord(full);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    loadActiveRecord();
  }, [selectedRecordId]);

  const filteredRecords = records.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.recordId.toLowerCase().includes(q) || (r.title && r.title.toLowerCase().includes(q));
    }
    return true;
  });

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
            <BookOpen size={22} color="var(--accent-indigo)" />
            <span>Shared Team Knowledge Records</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Briefs, Architecture Decisions, and Specifications tracked with stable IDs and immutable revision history.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline btn-sm" onClick={loadRecords}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>New Record</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', minHeight: '600px' }}>
        {/* Left Column: List */}
        <div>
          {/* Search & Filter */}
          <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {['', 'brief', 'decision', 'document'].map((t) => (
                <button
                  key={t}
                  className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Record Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
            {filteredRecords.map((r) => {
              const isSelected = selectedRecordId === r.recordId;
              return (
                <div
                  key={r.recordId}
                  className="glass-card"
                  onClick={() => {
                    setSelectedRecordId(r.recordId);
                    setActiveRev(null);
                  }}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-card)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
                      {r.recordId}
                    </span>
                    <span className="badge badge-open" style={{ fontSize: '0.68rem' }}>
                      Rev {r.currentRevision}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.title || r.type}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px', textTransform: 'capitalize' }}>
                    Type: {r.type} · Updated: {new Date(r.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Record Detail */}
        <div>
          {activeRecord ? (
            <RecordDetail
              record={activeRecord}
              initialRev={activeRev}
              onEditRecord={(rec, revDetail) => setEditTargetRecord({ record: rec, revDetail })}
              onReload={loadRecords}
            />
          ) : (
            <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
              Select a record from the left to view revisions, content, and ACLs.
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateRecordModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newRec) => {
            loadRecords();
            setSelectedRecordId(newRec.recordId);
          }}
        />
      )}

      {editTargetRecord && (
        <EditRecordModal
          record={editTargetRecord.record}
          currentRevisionDetail={editTargetRecord.revDetail}
          onClose={() => setEditTargetRecord(null)}
          onSuccess={(updated) => {
            loadRecords();
            setActiveRecord(updated);
          }}
        />
      )}
    </div>
  );
}
