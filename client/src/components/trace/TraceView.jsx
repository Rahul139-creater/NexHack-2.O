import React, { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { EvidenceTable } from './EvidenceTable.jsx';
import { DiffViewer } from '../flags/DiffViewer.jsx';
import {
  GitBranch,
  Layers,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Cpu,
  Search,
  ArrowDown,
  Sparkles,
  Bot
} from 'lucide-react';

export function TraceView({ initialTaskId }) {
  const { showToast } = useToast();
  const [taskIdInput, setTaskIdInput] = useState(initialTaskId || 'TSK-001');
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runTrace(idToTrace) {
    const id = idToTrace || taskIdInput.trim();
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getTrace(id);
      setTraceData(data);
    } catch (err) {
      showToast(err.message, 'error');
      setTraceData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialTaskId) {
      setTaskIdInput(initialTaskId);
      runTrace(initialTaskId);
    } else {
      runTrace('TSK-001');
    }
  }, [initialTaskId]);

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
            <GitBranch size={22} color="var(--accent-cyan)" />
            <span>Task Provenance & Corrective Lineage Graph</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Problem Statement Requirement #6: Trace who owned each step, which tool ran it, which revision was used, and trace corrections back to teammate decisions.
          </p>
        </div>

        {/* Input box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            className="input-field"
            style={{ width: '180px', height: '36px' }}
            placeholder="e.g. TSK-001"
            value={taskIdInput}
            onChange={(e) => setTaskIdInput(e.target.value.toUpperCase())}
          />
          <button className="btn btn-primary btn-sm" onClick={() => runTrace()} disabled={loading}>
            <Search size={14} />
            <span>{loading ? 'Tracing...' : 'Run Trace'}</span>
          </button>
        </div>
      </div>

      {/* Provenance DAG Flow */}
      {traceData ? (
        <div>
          <div className="trace-flow">
            {/* NODE 1: Task Baseline */}
            <div className="trace-card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                  Phase 1 · Task Definition & Brief
                </span>
                <span className={`badge badge-${traceData.task.status}`}>{traceData.task.status}</span>
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>{traceData.task.title}</h3>
              <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Task ID: <strong style={{ color: 'var(--text-main)' }}>{traceData.task.taskId}</strong></span>
                <span>Owner: <strong>{traceData.task.owner || 'None'}</strong></span>
                <span>Active Tool: <strong>{traceData.task.tool || 'None'}</strong></span>
                <span>Fencing Token: <strong>#{traceData.task.fencingToken}</strong></span>
              </div>
            </div>

            <div className="trace-connector-line" />

            {/* NODE 2: Changed Decision Root Cause */}
            <div className="trace-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#fbbf24' }}>
                  Phase 2 · Root Cause Decision Revision
                </span>
                <span className="badge badge-tool">DECISION CHANGE</span>
              </div>

              {traceData.flags && traceData.flags.length > 0 ? (
                traceData.flags.map((item, idx) => (
                  <div key={idx}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                      Teammate <strong>{item.changedRecord.changedBy || 'teammate'}</strong> revised record{' '}
                      <strong>{item.changedRecord.recordId}</strong> from <strong>Rev {item.changedRecord.fromRev}</strong> to{' '}
                      <strong>Rev {item.changedRecord.toRev}</strong>.
                    </p>
                    <DiffViewer
                      fromRev={item.changedRecord.fromRev}
                      toRev={item.changedRecord.toRev}
                      fromContent={item.changedRecord.fromContent}
                      toContent={item.changedRecord.toContent}
                      changedBy={item.changedRecord.changedBy}
                    />
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  No conflicting decision revisions detected for this task. It is running on current baselines.
                </div>
              )}
            </div>

            <div className="trace-connector-line" />

            {/* NODE 3: Intercepted Review Flag */}
            <div className="trace-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#f87171' }}>
                  Phase 3 · Automatic Stale Dependency Quarantine
                </span>
                <span className="badge badge-stale">Intervention Flag</span>
              </div>

              {traceData.flags && traceData.flags.length > 0 ? (
                traceData.flags.map((item, idx) => (
                  <div key={idx}>
                    <div style={{ fontWeight: 600, color: '#fca5a5', fontSize: '0.95rem' }}>
                      {item.flag.reason}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Flag ID: {item.flag._id} · Quarantine Status: <strong>{item.flag.status.toUpperCase()}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  Task was not marked stale.
                </div>
              )}
            </div>

            <div className="trace-connector-line" />

            {/* NODE 4: Human Review & Reset */}
            <div className="trace-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#34d399' }}>
                  Phase 4 · Teammate Review & Approval
                </span>
                <span className="badge badge-completed">Resolved</span>
              </div>

              {traceData.flags && traceData.flags.length > 0 && traceData.flags[0].flag.status === 'approved' ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>Approved by teammate: {traceData.flags[0].approvedBy}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Resolution Note: "{traceData.flags[0].flag.meta?.note || 'Reviewed diff and confirmed protocol update'}"
                  </div>
                  <div style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--text-muted)' }}>
                    Action taken: Task {traceData.task.taskId} atomically reset from <em>stale</em> to <strong>open</strong>.
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  Awaiting teammate / reviewer approval or no intervention required.
                </div>
              )}
            </div>

            <div className="trace-connector-line" />

            {/* NODE 5: Landed Agent Results */}
            <div className="trace-card" style={{ borderLeft: '4px solid var(--accent-indigo)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#a5b4fc' }}>
                  Phase 5 · Landed Agent Results ({traceData.results?.length || 0} attempts)
                </span>
                <span className="badge badge-result_saved">Exactly Once</span>
              </div>

              {traceData.results && traceData.results.length > 0 ? (
                traceData.results.map((res, idx) => (
                  <div key={idx} style={{
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginTop: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '6px' }}>
                      <span>Attempt #{res.attempt} · Author: <strong>{res.createdBy}</strong> ({res.tool})</span>
                      <span style={{ color: res.applied ? '#34d399' : '#f59e0b', fontWeight: 600 }}>
                        Applied: {res.applied ? 'YES (Applied to KB)' : 'SAVED (Pending landing)'}
                      </span>
                    </div>
                    <pre style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                      lineHeight: 1.5,
                      color: '#e2e8f0',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '120px',
                      overflowY: 'auto'
                    }}>
                      {res.body}
                    </pre>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  No agent results submitted yet.
                </div>
              )}
            </div>
          </div>

          {/* Evidence Audit Table Component */}
          <EvidenceTable traceData={traceData} />
        </div>
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
          Enter a Task ID above to generate its complete provenance trace graph.
        </div>
      )}
    </div>
  );
}
