import React, { useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from './api.js';
import { Navbar } from './components/Navbar.jsx';
import { Login } from './components/Login.jsx';
import { TasksView } from './components/TasksView.jsx';
import { RecordsView } from './components/RecordsView.jsx';
import { FlagsView } from './components/FlagsView.jsx';
import { AuditView } from './components/AuditView.jsx';
import { TraceView } from './components/TraceView.jsx';

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(true);
  const [traceTaskId, setTraceTaskId] = useState('');
  const [targetRecord, setTargetRecord] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const user = await api.getMe();
        setCurrentUser(user);
      } catch (err) {
        setStoredToken('');
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  function handleLogout() {
    setStoredToken('');
    setCurrentUser(null);
    setActiveTab('tasks');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading Team KB Harness...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div>
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'records') setTargetRecord(null);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="container">
        {activeTab === 'tasks' && (
          <TasksView
            onViewTrace={(id) => {
              setTraceTaskId(id);
              setActiveTab('trace');
            }}
            onOpenRecordRevision={(id, rev) => {
              setTargetRecord({ id, rev });
              setActiveTab('records');
            }}
          />
        )}

        {activeTab === 'records' && (
          <RecordsView
            initialRecordId={targetRecord?.id}
            initialRev={targetRecord?.rev}
          />
        )}

        {activeTab === 'flags' && (
          <FlagsView
            currentUser={currentUser}
            onViewTrace={(id) => {
              setTraceTaskId(id);
              setActiveTab('trace');
            }}
          />
        )}

        {activeTab === 'audit' && <AuditView />}

        {activeTab === 'trace' && (
          <TraceView initialTaskId={traceTaskId} />
        )}
      </main>
    </div>
  );
}

export default App;
