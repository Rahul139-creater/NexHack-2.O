import React from 'react';

export function Navbar({ activeTab, onSelectTab, currentUser, onLogout }) {
  const tabs = [
    { id: 'tasks', label: 'Tasks' },
    { id: 'records', label: 'Records' },
    { id: 'flags', label: 'Review Flags' },
    { id: 'audit', label: 'Audit Trail' },
    { id: 'trace', label: 'Provenance Trace' }
  ];

  return (
    <header className="navbar">
      <div className="nav-brand">
        <span>⚡ Team KB</span>
      </div>

      <nav className="nav-links">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="nav-user">
        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{currentUser.name}</span>
        <span className={`role-badge ${currentUser.role}`}>{currentUser.role}</span>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
