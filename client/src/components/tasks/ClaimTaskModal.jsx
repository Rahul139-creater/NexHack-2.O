import React, { useState } from 'react';
import { api } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { X, Shield, Bot, Cpu } from 'lucide-react';

export function ClaimTaskModal({ task, onClose, onSuccess }) {
  const { activeTool } = useAuth();
  const { showToast } = useToast();
  const [tool, setTool] = useState(activeTool || 'claude-code');
  const [loading, setLoading] = useState(false);

  async function handleClaim(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.claimTask(task.taskId, tool);
      showToast(`Task ${task.taskId} claimed! Fencing token is ${res.fencingToken}`, 'success');
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
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.1rem' }}>Claim Task: {task.taskId}</h3>
          <button className="btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleClaim}>
          <div className="modal-body">
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>{task.title}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Current Status: <span className={`badge badge-${task.status}`}>{task.status}</span> · Current Fencing Token: {task.fencingToken}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Select Agent Adapter Tool</label>
              <select className="select-field" value={tool} onChange={(e) => setTool(e.target.value)}>
                <option value="claude-code">Claude Code (MCP Adapter)</option>
                <option value="antigravity">Antigravity (CLI Adapter)</option>
                <option value="codex">Codex Agent</option>
                <option value="cli">Direct CLI Agent</option>
              </select>
            </div>

            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.8rem',
              color: 'var(--text-muted)'
            }}>
              Claiming will increment the task fencing token, grant a 5-minute lease, and set the task state to <strong>claimed</strong>. Any concurrent or previous worker with an older token will be fenced out.
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Claiming...' : 'Claim Task Lease'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
