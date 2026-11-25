import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { Navbar } from './components/layout/Navbar.jsx';
import { HeaderStats } from './components/layout/HeaderStats.jsx';
import { Toast } from './components/layout/Toast.jsx';
import { Login } from './components/auth/Login.jsx';
import { TasksView } from './components/tasks/TasksView.jsx';
import { RecordsView } from './components/records/RecordsView.jsx';
import { FlagsView } from './components/flags/FlagsView.jsx';
import { TraceView } from './components/trace/TraceView.jsx';
import { AuditView } from './components/audit/AuditView.jsx';
import { DemoSimulatorView } from './components/simulator/DemoSimulatorView.jsx';

export function App() {
  const { currentUser, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('tasks');
  const [traceTaskId, setTraceTaskId] = useState('TSK-001');
  const [targetRecord, setTargetRecord] = useState(null);
  const [statsTrigger, setStatsTrigger] = useState(0);

  function triggerRefresh() {
    setStatsTrigger((prev) => prev + 1);
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '12px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(56, 189, 248, 0.2)',
          borderTopColor: 'var(--accent-cyan)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Initializing Team KB Harness...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="app-wrapper">
      <div className="app-bg-glow" />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'records') setTargetRecord(null);
        }}
      />

      {/* Main Workspace */}
      <main className="main-container">
        {/* Top Metric Ribbon */}
        <HeaderStats refreshTrigger={statsTrigger} />

        {/* Tab Routing */}
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
            onViewTrace={(id) => {
              setTraceTaskId(id);
              setActiveTab('trace');
            }}
          />
        )}

        {activeTab === 'trace' && (
          <TraceView initialTaskId={traceTaskId} />
        )}

        {activeTab === 'audit' && (
          <AuditView />
        )}

        {activeTab === 'simulator' && (
          <DemoSimulatorView
            onViewTrace={(id) => {
              setTraceTaskId(id);
              setActiveTab('trace');
            }}
            onRefreshAll={triggerRefresh}
          />
        )}
      </main>

      {/* Global Toast System */}
      <Toast />
    </div>
  );
}

export default App;
