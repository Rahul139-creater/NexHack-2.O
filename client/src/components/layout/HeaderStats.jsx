import React, { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import { Layers, AlertTriangle, FileText, Activity, ShieldCheck } from 'lucide-react';

export function HeaderStats({ refreshTrigger }) {
  const [stats, setStats] = useState({
    tasksTotal: 0,
    tasksActive: 0,
    pendingFlags: 0,
    recordsCount: 0,
    eventsCount: 0
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [tasks, flags, records, events] = await Promise.all([
          api.getTasks().catch(() => []),
          api.getFlags('pending').catch(() => []),
          api.getRecords().catch(() => []),
          api.getEvents().catch(() => [])
        ]);

        const active = tasks.filter(t => ['claimed', 'result_saved', 'stale'].includes(t.status)).length;

        setStats({
          tasksTotal: tasks.length,
          tasksActive: active,
          pendingFlags: flags.length,
          recordsCount: records.length,
          eventsCount: events.length
        });
      } catch (e) {
        // quiet fail
      }
    }
    fetchStats();
  }, [refreshTrigger]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '12px',
      marginBottom: '20px'
    }}>
      <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-cyan)'
        }}>
          <Layers size={20} />
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Knowledge Tasks
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {stats.tasksTotal} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400 }}>({stats.tasksActive} in-flight)</span>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px',
        borderColor: stats.pendingFlags > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)'
      }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: stats.pendingFlags > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: stats.pendingFlags > 0 ? '#f87171' : '#34d399'
        }}>
          <AlertTriangle size={20} />
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Stale Interventions
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stats.pendingFlags > 0 ? '#f87171' : 'var(--text-main)' }}>
            {stats.pendingFlags} <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 400 }}>{stats.pendingFlags > 0 ? 'action needed' : 'all clean'}</span>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-indigo)'
        }}>
          <FileText size={20} />
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            KB Records & Briefs
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {stats.recordsCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400 }}>tracked</span>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent-purple)'
        }}>
          <Activity size={20} />
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Audit Evidence Log
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {stats.eventsCount} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400 }}>events</span>
          </div>
        </div>
      </div>
    </div>
  );
}
