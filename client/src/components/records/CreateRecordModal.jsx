import React, { useState } from 'react';
import { api, SEED_USERS } from '../../api/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { X, Plus, ShieldCheck } from 'lucide-react';

export function CreateRecordModal({ onClose, onSuccess }) {
  const { currentUser, activeTool } = useAuth();
  const { showToast } = useToast();
  const [type, setType] = useState('decision');
  const [customId, setCustomId] = useState('');
  const [content, setContent] = useState('');
  const [readers, setReaders] = useState(['alice', 'bob', 'carol']);
  const [writers, setWriters] = useState([currentUser?.userId || 'alice']);
  const [loading, setLoading] = useState(false);

  function toggleReader(id) {
    if (readers.includes(id)) {
      setReaders(readers.filter(r => r !== id));
    } else {
      setReaders([...readers, id]);
    }
  }

  function toggleWriter(id) {
    if (writers.includes(id)) {
      setWriters(writers.filter(w => w !== id));
    } else {
      setWriters([...writers, id]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) {
      showToast('Please provide record content', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type,
        content: content.trim(),
        readers,
        writers,
        ...(customId.trim() ? { recordId: customId.trim() } : {})
      };
      const record = await api.createRecord(payload, activeTool);
      showToast(`Record ${record.recordId} created (Rev 1)`, 'success');
      onSuccess(record);
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
          <h3 style={{ fontSize: '1.1rem' }}>Create New Knowledge Record (Rev 1)</h3>
          <button className="btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Record Type</label>
                <select className="select-field" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="brief">Project Brief (BRF)</option>
                  <option value="decision">Architecture Decision (DEC)</option>
                  <option value="document">Team Specification / Doc (DOC)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Record ID (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Auto-generated if empty (e.g. DEC-003)"
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Initial Markdown Content (Revision 1)</label>
              <textarea
                className="textarea-field"
                style={{ minHeight: '140px', fontFamily: 'var(--font-mono)' }}
                placeholder="# Decision Title\nDescribe the consensus, architectural requirements, or specifications..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            {/* ACL Permissions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
              <div>
                <label className="form-label">Read Access (readers ACL)</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {SEED_USERS.map((u) => (
                    <button
                      type="button"
                      key={u.userId}
                      className={`btn btn-sm ${readers.includes(u.userId) ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleReader(u.userId)}
                    >
                      {u.name.split(' ')[0]} ({u.role})
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Write Access (writers ACL)</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {SEED_USERS.map((u) => (
                    <button
                      type="button"
                      key={u.userId}
                      className={`btn btn-sm ${writers.includes(u.userId) ? 'btn-accent' : 'btn-outline'}`}
                      onClick={() => toggleWriter(u.userId)}
                    >
                      {u.name.split(' ')[0]} ({u.role})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
