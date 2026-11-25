import React, { useState } from 'react';
import { api } from '../../api/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { X, Plus, Trash2 } from 'lucide-react';

export function CreateTaskModal({ onClose, onSuccess, existingRecords = [] }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [briefRecordId, setBriefRecordId] = useState(
    existingRecords.find(r => r.type === 'brief')?.recordId || 'BRF-001'
  );
  const [briefRev, setBriefRev] = useState(1);
  const [dependsOn, setDependsOn] = useState([]);
  const [loading, setLoading] = useState(false);

  function addDependency() {
    const available = existingRecords.find(r => r.type === 'decision')?.recordId || 'DEC-001';
    setDependsOn([...dependsOn, { recordId: available, rev: 1 }]);
  }

  function updateDep(index, field, value) {
    const updated = [...dependsOn];
    updated[index][field] = field === 'rev' ? parseInt(value, 10) || 1 : value;
    setDependsOn(updated);
  }

  function removeDep(index) {
    setDependsOn(dependsOn.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a task title', 'error');
      return;
    }

    setLoading(true);
    try {
      const task = await api.createTask({
        title: title.trim(),
        briefRef: {
          recordId: briefRecordId,
          rev: parseInt(briefRev, 10) || 1
        },
        dependsOn
      });
      showToast(`Task ${task.taskId} created successfully`, 'success');
      onSuccess(task);
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
          <h3 style={{ fontSize: '1.1rem' }}>Create New Knowledge Task</h3>
          <button className="btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Task Title / Objective</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Implement Argon2 password hashing protocol"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }} className="form-group">
              <div>
                <label className="form-label">Target Brief Reference</label>
                <input
                  type="text"
                  className="input-field"
                  value={briefRecordId}
                  onChange={(e) => setBriefRecordId(e.target.value)}
                  placeholder="BRF-001"
                  required
                />
              </div>
              <div>
                <label className="form-label">Brief Revision</label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  value={briefRev}
                  onChange={(e) => setBriefRev(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>Governing Decisions & Dependencies</label>
                <button type="button" className="btn btn-outline btn-sm" onClick={addDependency}>
                  <Plus size={14} />
                  <span>Add Dependency</span>
                </button>
              </div>

              {dependsOn.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '8px 0' }}>
                  No dependencies attached. Agent will reference only the brief.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dependsOn.map((dep, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="DEC-001"
                        value={dep.recordId}
                        onChange={(e) => updateDep(idx, 'recordId', e.target.value)}
                        required
                      />
                      <input
                        type="number"
                        min="1"
                        className="input-field"
                        placeholder="Rev"
                        value={dep.rev}
                        onChange={(e) => updateDep(idx, 'rev', e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => removeDep(idx)}
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating Task...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
