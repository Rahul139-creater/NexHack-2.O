import React, { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  X,
  Bot,
  Cpu,
  Clock,
  Shield,
  FileText,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  ExternalLink
} from 'lucide-react';

export function TaskDetailModal({
  taskId,
  onClose,
  onViewTrace,
  onOpenRecordRevision,
  onClaim,
  onSubmitResult,
  onTaskUpdated
}) {
  const { currentUser, activeTool } = useAuth();
  const { showToast } = useToast();
  const [context, setContext] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadDetails() {
    try {
      setLoading(true);
      setError('');
      const [ctx, events] = await Promise.all([
        api.getTaskContext(taskId),
        api.getEvents({ taskId })
      ]);
      setContext(ctx);
      setTimeline(events);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [taskId]);

  async function handleResume() {
    setResumeLoading(true);
    try {
      const res = await api.resumeTask(taskId, activeTool);
      showToast(res.message || 'Task completed successfully', 'success');
      await loadDetails();
      if (onTaskUpdated) onTaskUpdated();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setResumeLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'var(--text-muted)' }}>Loading complete task context...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Error</h3>
            <button className="btn-ghost" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="modal-body">
            <div style={{ color: '#ef4444' }}>{error || 'Task context could not be loaded.'}</div>
          </div>
        </div>
      </div>
    );
  }

  const { task, latestResult, citedSources } = context;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container large" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`badge badge-${task.status}`}>{task.status}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--accent-cyan)' }}>
              {task.taskId}
            </span>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{task.title}</h2>

          {/* Metadata Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '20px',
            fontSize: '0.82rem'
          }}>
            <div>
              <span style={{ color: 'var(--text-dim)', display: 'block' }}>Current Owner</span>
              <strong style={{ color: 'var(--text-main)' }}>{task.owner || 'None (Unassigned)'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', display: 'block' }}>Tool Adapter</span>
              <span className="badge badge-tool">{task.tool || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', display: 'block' }}>Fencing Token</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{task.fencingToken}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)', display: 'block' }}>Brief Reference</span>
              {task.briefRef ? (
                <button
                  className="btn-ghost"
                  style={{ padding: 0, color: 'var(--accent-cyan)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
                  onClick={() => onOpenRecordRevision && onOpenRecordRevision(task.briefRef.recordId, task.briefRef.rev)}
                >
                  {task.briefRef.recordId}@{task.briefRef.rev}
                </button>
              ) : '—'}
            </div>
          </div>

          {/* Reconstructed Context: Problem Statement #3 Demonstration */}
          <div className="glass-card" style={{ marginBottom: '20px', borderLeft: '3px solid var(--accent-indigo)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={16} color="var(--accent-indigo)" />
                <span>Zero-Chat-Handoff Context (Reconstructed from KB)</span>
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                {latestResult ? `Attempt ${latestResult.attempt} · Saved by ${latestResult.createdBy} (${latestResult.tool})` : 'No draft yet'}
              </span>
            </div>

            {latestResult ? (
              <div>
                <pre style={{
                  background: '#070b14',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  color: '#e2e8f0',
                  marginBottom: '12px'
                }}>
                  {latestResult.body}
                </pre>

                {/* Cited Sources List with Historical Snapshots */}
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Historical Cited Sources Locked at Time of Creation:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {citedSources && citedSources.length > 0 ? (
                      citedSources.map((cs, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(0, 0, 0, 0.25)',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                              {cs.recordId} (Rev {cs.rev})
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              "{cs.content?.split('\n')[0]?.substring(0, 50)}..."
                            </span>
                          </div>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => onOpenRecordRevision && onOpenRecordRevision(cs.recordId, cs.rev)}
                          >
                            <ExternalLink size={12} />
                            <span>View Source</span>
                          </button>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No sources cited</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                This task has not been executed yet. An agent tool can claim it to begin execution.
              </div>
            )}
          </div>

          {/* Audit Timeline */}
          <div>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-muted)' }}>
              Execution Audit Timeline ({timeline.length} events)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {timeline.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No events recorded.</div>
              ) : (
                timeline.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(15, 23, 42, 0.4)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      borderLeft: '2px solid var(--border-medium)'
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--accent-cyan)' }}>{ev.action}</strong> by <strong>{ev.actor}</strong> ({ev.tool})
                    </div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button
            className="btn btn-outline"
            onClick={() => {
              onClose();
              onViewTrace(taskId);
            }}
          >
            <GitBranch size={16} />
            <span>View Full Provenance Trace</span>
          </button>

          {['open', 'stale'].includes(task.status) && (
            <button
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onClaim(task);
              }}
            >
              <Cpu size={16} />
              <span>Claim Task Lease</span>
            </button>
          )}

          {task.status === 'claimed' && (
            <button
              className="btn btn-accent"
              onClick={() => {
                onClose();
                onSubmitResult(task);
              }}
            >
              <FileText size={16} />
              <span>Submit Agent Result</span>
            </button>
          )}

          {task.status === 'result_saved' && (
            <button
              className="btn btn-success"
              onClick={handleResume}
              disabled={resumeLoading}
            >
              <RotateCcw size={16} />
              <span>{resumeLoading ? 'Completing...' : 'Resume & Complete Task (Exactly Once)'}</span>
            </button>
          )}

          {task.status === 'completed' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleResume}
              disabled={resumeLoading}
              title="Test idempotency: calls resume again to prove exactly-once guarantee"
            >
              <CheckCircle2 size={16} color="#10b981" />
              <span>Verify Idempotency (Repeat Resume)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
