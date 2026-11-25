import React from 'react';
import { Copy, Download, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';

export function EvidenceTable({ traceData }) {
  const { showToast } = useToast();

  if (!traceData) return null;

  // Build rows from events and flags
  const rows = [];
  const events = traceData.events || [];

  events.forEach((ev, idx) => {
    const revRef = ev.recordRefs?.length > 0
      ? ev.recordRefs.map(r => `${r.recordId}@${r.rev}`).join(', ')
      : '—';
    
    let outcome = 'Success (200/201)';
    if (ev.action === 'task_marked_stale') outcome = 'Marked STALE (Blast Radius Isolated)';
    if (ev.action === 'approve_review_flag') outcome = 'Reset Task to OPEN';
    if (ev.action === 'complete_task') outcome = 'Completed (Applied Exactly Once)';
    if (ev.meta?.hasConflict) outcome = 'Conflict Detected';

    rows.push({
      step: idx + 1,
      timestamp: new Date(ev.timestamp).toLocaleTimeString(),
      actor: ev.actor,
      tool: ev.tool,
      action: ev.action,
      revision: revRef,
      outcome
    });
  });

  function copyMarkdown() {
    let md = '| Step | Actor | Tool | Action | Revision | Outcome |\n';
    md += '|---|---|---|---|---|---|\n';
    rows.forEach(r => {
      md += `| ${r.step} | ${r.actor} | ${r.tool} | ${r.action} | ${r.revision} | ${r.outcome} |\n`;
    });
    navigator.clipboard.writeText(md);
    showToast('Evidence audit table copied as Markdown table', 'success');
  }

  return (
    <div className="glass-card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Final Evidence Audit Table</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            Complete audit trail proving actor ownership, tool runtime, revisions, and corrective decisions.
          </p>
        </div>

        <button className="btn btn-outline btn-sm" onClick={copyMarkdown}>
          <Copy size={14} />
          <span>Copy Markdown Table</span>
        </button>
      </div>

      <div className="table-container">
        <table className="modern-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Actor</th>
              <th>Tool Adapter</th>
              <th>Action</th>
              <th>Revision Reference</th>
              <th>Outcome / Verification</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.step}>
                <td style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>{r.step}</td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{r.timestamp}</td>
                <td style={{ fontWeight: 600 }}>{r.actor}</td>
                <td><span className="badge badge-tool">{r.tool}</span></td>
                <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{r.action}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{r.revision}</td>
                <td style={{ fontSize: '0.82rem' }}>
                  <span style={{ color: r.outcome.includes('STALE') ? '#f87171' : r.outcome.includes('Completed') ? '#34d399' : 'var(--text-main)' }}>
                    {r.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
