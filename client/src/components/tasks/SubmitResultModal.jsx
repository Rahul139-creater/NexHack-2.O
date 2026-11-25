import React, { useState } from 'react';
import { api } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { X, Plus, Trash2, ShieldCheck } from 'lucide-react';

export function SubmitResultModal({ task, onClose, onSuccess }) {
  const { activeTool } = useAuth();
  const { showToast } = useToast();
  const [attempt, setAttempt] = useState(1);
  const [body, setBody] = useState('');
  const [citations, setCitations] = useState(
    task.dependsOn?.length > 0
      ? task.dependsOn.map(d => ({ recordId: d.recordId, rev: d.rev }))
      : [{ recordId: task.briefRef?.recordId || 'DEC-001', rev: task.briefRef?.rev || 1 }]
  );
  const [baseRevisions, setBaseRevisions] = useState(
    task.dependsOn?.length > 0
      ? task.dependsOn.map(d => ({ recordId: d.recordId, rev: d.rev }))
      : [{ recordId: 'DEC-001', rev: 1 }]
  );
  const [fencingToken, setFencingToken] = useState(task.fencingToken || 1);
  const [loading, setLoading] = useState(false);

  function addCitation() {
    setCitations([...citations, { recordId: 'DEC-001', rev: 1 }]);
  }
  function updateCitation(idx, field, val) {
    const list = [...citations];
    list[idx][field] = field === 'rev' ? parseInt(val, 10) || 1 : val;
    setCitations(list);
  }
  function removeCitation(idx) {
    setCitations(citations.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim()) {
      showToast('Please provide the result body / output', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.submitResult(task.taskId, {
        attempt: parseInt(attempt, 10) || 1,
        body: body.trim(),
        citations,
        fencingToken: parseInt(fencingToken, 10),
        baseRevisions: citations // use citations as baseRevisions
      }, activeTool);

      showToast(`Result saved! Status: ${res.status}`, 'success');
      onSuccess(res.task);
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem' }}>Submit Result for {task.taskId}</h3>
          <button className="btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label">Attempt Number</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={attempt}
                  onChange={(e) => setAttempt(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Fencing Token (Lease Lock)</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={fencingToken}
                  onChange={(e) => setFencingToken(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Agent Output / Solution Draft</label>
              <textarea
                className="textarea-field"
                style={{ minHeight: '140px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                placeholder="Paste the generated plan, code, or documentation..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>Cited Sources & Base Revisions</label>
                <button type="button" className="btn btn-outline btn-sm" onClick={addCitation}>
                  <Plus size={14} />
                  <span>Add Source Citation</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {citations.map((c, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="DEC-001"
                      value={c.recordId}
                      onChange={(e) => updateCitation(idx, 'recordId', e.target.value)}
                      required
                    />
                    <input
                      type="number"
                      min="1"
                      className="input-field"
                      placeholder="Rev"
                      value={c.rev}
                      onChange={(e) => updateCitation(idx, 'rev', e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => removeCitation(idx)}
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting Result...' : 'Submit Result & Check Base Revs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
