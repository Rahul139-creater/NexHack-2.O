import React, { useState } from 'react';
import { api, setStoredToken } from '../api.js';

export function Login({ onLoginSuccess }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const devTokens = [
    { label: 'Alice (Lead)', token: 'token_alice_lead_dev_secret_key_123' },
    { label: 'Bob (Dev)', token: 'token_bob_dev_secret_key_456' },
    { label: 'Carol (Reviewer)', token: 'token_carol_reviewer_secret_key_789' }
  ];

  async function handleLogin(tokenToUse) {
    const activeToken = tokenToUse || token.trim();
    if (!activeToken) {
      setError('Please enter or select an API token.');
      return;
    }

    setLoading(true);
    setError('');
    setStoredToken(activeToken);

    try {
      const user = await api.getMe();
      onLoginSuccess(user);
    } catch (err) {
      setStoredToken('');
      setError(err.message || 'Invalid token or server unreachable');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-box">
      <h1 className="login-title">Team KB Harness</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
        Shared Multi-Agent Knowledge Base
      </p>

      {error && <div className="alert-error">{error}</div>}

      <div style={{ marginBottom: '16px', textAlign: 'left' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          API Token:
        </label>
        <input
          type="password"
          placeholder="Paste your bearer token here..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ width: '100%', marginBottom: '12px' }}
        />
        <button
          className="btn-primary"
          onClick={() => handleLogin()}
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </div>

      {import.meta.env.DEV && (
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Quick Seed Dev Tokens (Local Development Only):
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {devTokens.map((t) => (
              <button
                key={t.label}
                className="filter-chip"
                onClick={() => {
                  setToken(t.token);
                  handleLogin(t.token);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
