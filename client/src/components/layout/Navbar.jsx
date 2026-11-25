import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Layers,
  FileText,
  AlertTriangle,
  GitBranch,
  Activity,
  PlayCircle,
  User,
  LogOut,
  ChevronDown,
  Cpu,
  Shield,
  Bot
} from 'lucide-react';

export function Navbar({ activeTab, onSelectTab, pendingFlagsCount = 0 }) {
  const { currentUser, logout, loginAsSeedUser, seedUsers, activeTool, setActiveTool } = useAuth();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showToolMenu, setShowToolMenu] = useState(false);

  const tools = [
    { id: 'claude-code', label: 'Claude Code (MCP)', icon: Bot },
    { id: 'antigravity', label: 'Antigravity (CLI)', icon: Cpu },
    { id: 'mcp', label: 'MCP Generic Adapter', icon: Bot },
    { id: 'cli', label: 'CLI Direct Runner', icon: Cpu },
    { id: 'ui', label: 'Web Dashboard (UI)', icon: User }
  ];

  return (
    <nav className="navbar">
      <div className="nav-content">
        {/* Brand */}
        <div className="nav-brand" onClick={() => onSelectTab('tasks')}>
          <div className="nav-brand-logo">
            <Bot size={22} />
          </div>
          <div>
            <div className="nav-brand-title">Team KB Harness</div>
            <div className="nav-brand-subtitle">Multi-Agent Knowledge Base</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="nav-tabs">
          <button
            className={`nav-tab-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => onSelectTab('tasks')}
          >
            <Layers size={16} />
            <span>Tasks</span>
          </button>

          <button
            className={`nav-tab-item ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => onSelectTab('records')}
          >
            <FileText size={16} />
            <span>Records & Briefs</span>
          </button>

          <button
            className={`nav-tab-item ${activeTab === 'flags' ? 'active' : ''}`}
            onClick={() => onSelectTab('flags')}
          >
            <AlertTriangle size={16} />
            <span>Review Flags</span>
            {pendingFlagsCount > 0 && (
              <span className="nav-tab-count alert">{pendingFlagsCount}</span>
            )}
          </button>

          <button
            className={`nav-tab-item ${activeTab === 'trace' ? 'active' : ''}`}
            onClick={() => onSelectTab('trace')}
          >
            <GitBranch size={16} />
            <span>Provenance Trace</span>
          </button>

          <button
            className={`nav-tab-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => onSelectTab('audit')}
          >
            <Activity size={16} />
            <span>Audit Trail</span>
          </button>

          <button
            className={`nav-tab-item ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => onSelectTab('simulator')}
            style={{
              background: activeTab === 'simulator' ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.4) 0%, rgba(56, 189, 248, 0.4) 100%)' : 'rgba(99, 102, 241, 0.1)',
              borderColor: 'rgba(99, 102, 241, 0.3)'
            }}
          >
            <PlayCircle size={16} color="#38bdf8" />
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Agent Simulator</span>
          </button>
        </div>

        {/* User Profile & Active Tool Switcher */}
        <div className="nav-profile">
          {/* Active Tool Selector */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setShowToolMenu(!showToolMenu);
                setShowPersonaMenu(false);
              }}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                gap: '6px',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                background: 'rgba(56, 189, 248, 0.08)'
              }}
            >
              <Cpu size={14} color="var(--accent-cyan)" />
              <span>Tool: {activeTool}</span>
              <ChevronDown size={12} />
            </button>

            {showToolMenu && (
              <div
                className="glass-card"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  width: '210px',
                  padding: '6px',
                  zIndex: 60,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '6px 8px', textTransform: 'uppercase' }}>
                  Simulate Agent Adapter:
                </div>
                {tools.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTool(t.id);
                      setShowToolMenu(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: activeTool === t.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                      color: activeTool === t.id ? 'var(--accent-cyan)' : 'var(--text-main)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <t.icon size={14} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Persona Switcher */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setShowPersonaMenu(!showPersonaMenu);
                setShowToolMenu(false);
              }}
              style={{ gap: '8px', padding: '6px 12px' }}
            >
              <span className={`badge badge-role-${currentUser?.role || 'dev'}`}>
                {currentUser?.role}
              </span>
              <span style={{ fontWeight: 600 }}>{currentUser?.name || currentUser?.userId}</span>
              <ChevronDown size={14} />
            </button>

            {showPersonaMenu && (
              <div
                className="glass-card"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  width: '260px',
                  padding: '8px',
                  zIndex: 60,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', padding: '6px 8px', textTransform: 'uppercase' }}>
                  Switch Test Persona (Seed Users):
                </div>
                {seedUsers.map((u) => (
                  <button
                    key={u.userId}
                    onClick={async () => {
                      await loginAsSeedUser(u.userId);
                      setShowPersonaMenu(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: currentUser?.userId === u.userId ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      marginBottom: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.name}</span>
                      <span className={`badge badge-role-${u.role}`}>{u.role}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      {u.description}
                    </div>
                  </button>
                ))}

                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '6px', paddingTop: '6px' }}>
                  <button
                    onClick={logout}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      color: '#f87171',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
