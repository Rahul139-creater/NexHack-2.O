import React, { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { FlagDetail } from './FlagDetail.jsx';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Filter,
  ShieldCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export function FlagsView({ onViewTrace }) {
  const { showToast } = useToast();
  const [flags, setFlags] = useState([]);
  const [selectedFlagId, setSelectedFlagId] = useState(null);
  const [activeFlagDetail, setActiveFlagDetail] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadFlags() {
    setLoading(true);
    try {
      const data = await api.getFlags(statusFilter);
      // Sort pending first
      const sorted = [...data].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      setFlags(sorted);
      if (!selectedFlagId && sorted.length > 0) {
        setSelectedFlagId(sorted[0]._id);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlags();
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedFlagId) return;
    async function loadDetail() {
      try {
        const detail = await api.getFlag(selectedFlagId);
        setActiveFlagDetail(detail);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
    loadDetail();
  }, [selectedFlagId]);

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
            <AlertTriangle size={22} color="#f87171" />
            <span>Review Flags & Stale Interventions</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Automatic stale task quarantine when decisions change. Evaluate diffs, check blast radius, and approve task resets.
          </p>
        </div>

        <button className="btn btn-outline btn-sm" onClick={loadFlags}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', minHeight: '600px' }}>
        {/* Left Column: Flag List */}
        <div>
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {[
              { label: 'All', val: '' },
              { label: 'Pending', val: 'pending' },
              { label: 'Approved', val: 'approved' },
              { label: 'Rejected', val: 'rejected' }
            ].map(f => (
              <button
                key={f.val}
                className={`btn btn-sm ${statusFilter === f.val ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                onClick={() => setStatusFilter(f.val)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
            {flags.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-dim)' }}>
                <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                <div style={{ fontWeight: 600 }}>All Clear!</div>
                <div style={{ fontSize: '0.78rem' }}>No review flags matching current filter.</div>
              </div>
            ) : (
              flags.map((f) => {
                const isSelected = selectedFlagId === f._id;
                return (
                  <div
                    key={f._id}
                    className="glass-card"
                    onClick={() => setSelectedFlagId(f._id)}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                      background: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-card)',
                      borderLeft: f.status === 'pending' ? '3px solid #ef4444' : '3px solid #10b981'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                        {f.taskId}
                      </span>
                      <span className={`badge badge-${f.status === 'pending' ? 'stale' : 'completed'}`} style={{ fontSize: '0.68rem' }}>
                        {f.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {f.reason}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      Detected: {new Date(f.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Flag Detail & Diff */}
        <div>
          {activeFlagDetail ? (
            <FlagDetail
              flagData={activeFlagDetail}
              onResolved={loadFlags}
              onViewTrace={onViewTrace}
            />
          ) : (
            <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
              Select a review flag on the left to inspect root-cause revision diffs and authorize task resets.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
