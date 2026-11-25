import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Bot,
  Cpu,
  Shield,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Key
} from 'lucide-react';

export function Login() {
  const { loginWithToken, loginAsSeedUser, seedUsers } = useAuth();
  const [customToken, setCustomToken] = useState('');
  const [selectedTool, setSelectedTool] = useState('claude-code');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCustomLogin(e) {
    e.preventDefault();
    if (!customToken.trim()) {
      setError('Please provide an API token or choose a quick test persona.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await loginWithToken(customToken.trim(), selectedTool);
    } catch (err) {
      setError(err.message || 'Authentication failed. Check server connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSeedLogin(userId, tool) {
    setLoading(true);
    setError('');
    try {
      await loginAsSeedUser(userId, tool);
    } catch (err) {
      setError(err.message || 'Failed to authenticate with seed user.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      position: 'relative',
      zIndex: 1
    }}>
      <div style={{ maxWidth: '1000px', width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '9999px',
            padding: '6px 14px',
            marginBottom: '16px'
          }}>
            <Sparkles size={14} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, letterSpacing: '0.05em' }}>
              NEXHACK 2.0 · PROBLEM STATEMENT 01
            </span>
          </div>
          
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #ffffff 0%, #38bdf8 50%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px'
          }}>
            Multi-Agent Knowledge Base Harness
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '680px', margin: '0 auto' }}>
            Unified team coordination platform connecting Claude Code, Antigravity, and developer agents with seamless handoffs, decision tracking, and immutable audit evidence.
          </p>
        </div>

        {error && (
          <div className="glass-card" style={{
            borderColor: '#ef4444',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#fca5a5',
            padding: '12px 16px',
            marginBottom: '24px',
            textAlign: 'center',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Quick Persona Selector */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-cyan)'
              }}>
                <Bot size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Quick Seed Personas</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Select a predefined role to test permissions & handoffs</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {seedUsers.map((u) => (
                <div
                  key={u.userId}
                  className="glass-card"
                  style={{
                    padding: '14px',
                    cursor: 'pointer',
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderColor: 'var(--border-medium)',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => handleSeedLogin(u.userId, u.tool)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{u.name}</span>
                      <span className={`badge badge-role-${u.role}`}>{u.role}</span>
                    </div>
                    <span className="badge badge-tool">{u.tool}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    {u.description}
                  </p>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', justifyContent: 'space-between' }}
                    disabled={loading}
                  >
                    <span>Launch as {u.name.split(' ')[0]}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Bearer Token Sign In */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-indigo)'
                }}>
                  <Key size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Custom Token Authentication</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Sign in with any generated agent or bearer token</p>
                </div>
              </div>

              <form onSubmit={handleCustomLogin}>
                <div className="form-group">
                  <label className="form-label">Bearer Token</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Paste your bearer token here..."
                      value={customToken}
                      onChange={(e) => setCustomToken(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Client Tool Adapter</label>
                  <select
                    className="select-field"
                    value={selectedTool}
                    onChange={(e) => setSelectedTool(e.target.value)}
                  >
                    <option value="claude-code">Claude Code (MCP Adapter)</option>
                    <option value="antigravity">Antigravity (CLI Adapter)</option>
                    <option value="codex">Codex / LLM Runner</option>
                    <option value="ui">Web UI Dashboard</option>
                    <option value="api">Generic REST API</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px', marginTop: '8px' }}
                  disabled={loading}
                >
                  <Lock size={16} />
                  <span>{loading ? 'Authenticating...' : 'Sign In With Token'}</span>
                </button>
              </form>
            </div>

            {/* Feature Highlights checklist */}
            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.78rem',
              color: 'var(--text-dim)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Zero Chat Copying: Complete context reconstructed via stable IDs</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Role Gating: Dev, Reviewer, and Lead ACL enforcement</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Crash Resilient: Exactly-once completion idempotency guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
