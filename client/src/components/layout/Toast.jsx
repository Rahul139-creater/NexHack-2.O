import React from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export function Toast() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item ${t.type}`}>
          {t.type === 'success' && <CheckCircle2 size={18} color="#10b981" />}
          {t.type === 'error' && <AlertCircle size={18} color="#ef4444" />}
          {t.type === 'warning' && <AlertTriangle size={18} color="#f59e0b" />}
          {t.type === 'info' && <Info size={18} color="#38bdf8" />}
          
          <div style={{ flex: 1, fontSize: '0.875rem' }}>{t.message}</div>
          
          <button
            onClick={() => removeToast(t.id)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
