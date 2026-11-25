import React, { useState, useEffect } from 'react';
import { api } from '../../api/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { TaskKanban } from './TaskKanban.jsx';
import { TaskTable } from './TaskTable.jsx';
import { TaskDetailModal } from './TaskDetailModal.jsx';
import { CreateTaskModal } from './CreateTaskModal.jsx';
import { ClaimTaskModal } from './ClaimTaskModal.jsx';
import { SubmitResultModal } from './SubmitResultModal.jsx';
import {
  Plus,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  Filter,
  Layers,
  Sparkles
} from 'lucide-react';

export function TasksView({ onViewTrace, onOpenRecordRevision }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [records, setRecords] = useState([]);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [claimTargetTask, setClaimTargetTask] = useState(null);
  const [submitTargetTask, setSubmitTargetTask] = useState(null);

  const statuses = [
    { label: 'All Tasks', value: '' },
    { label: 'Open', value: 'open' },
    { label: 'Claimed', value: 'claimed' },
    { label: 'Result Saved', value: 'result_saved' },
    { label: 'Completed', value: 'completed' },
    { label: 'Stale (Changed Decisions)', value: 'stale' },
    { label: 'Conflict', value: 'conflict' }
  ];

  async function loadData() {
    setLoading(true);
    try {
      const [tasksData, recordsData] = await Promise.all([
        api.getTasks(statusFilter),
        api.getRecords().catch(() => [])
      ]);
      setTasks(tasksData);
      setRecords(recordsData);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function handleQuickResume(taskId) {
    try {
      const res = await api.resumeTask(taskId);
      showToast(res.message || 'Task completed successfully', 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.taskId.toLowerCase().includes(query) ||
      t.title.toLowerCase().includes(query) ||
      (t.owner && t.owner.toLowerCase().includes(query)) ||
      (t.tool && t.tool.toLowerCase().includes(query))
    );
  });

  return (
    <div>
      {/* Action Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} color="var(--accent-cyan)" />
            <span>Task Coordination & Handoff Board</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Claim tasks, hand off work across Claude Code & Antigravity, and review progress without copying chat logs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View mode toggle */}
          <div style={{ background: 'var(--bg-tertiary)', padding: '3px', borderRadius: '8px', display: 'flex', gap: '2px' }}>
            <button
              className={`btn-ghost btn-sm ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              style={{
                background: viewMode === 'kanban' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                padding: '6px 10px'
              }}
              title="Kanban View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className={`btn-ghost btn-sm ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                color: viewMode === 'table' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                padding: '6px 10px'
              }}
              title="Table View"
            >
              <List size={16} />
            </button>
          </div>

          <button className="btn btn-outline btn-sm" onClick={loadData}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {statuses.map((st) => (
            <button
              key={st.value}
              className={`btn btn-sm ${statusFilter === st.value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setStatusFilter(st.value)}
              style={{ fontSize: '0.78rem' }}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
            placeholder="Search by ID or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ marginBottom: '12px', animation: 'spin 1s linear infinite' }} />
          <p>Loading knowledge base tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Layers size={36} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>No Tasks Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            {statusFilter ? `No tasks found matching status '${statusFilter}'` : 'Create your first task to begin agent collaboration.'}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} />
            <span>Create New Task</span>
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        <TaskKanban
          tasks={filteredTasks}
          onSelectTask={(id) => setSelectedTaskId(id)}
          onClaimTask={(task) => setClaimTargetTask(task)}
          onResumeTask={handleQuickResume}
        />
      ) : (
        <TaskTable
          tasks={filteredTasks}
          onSelectTask={(id) => setSelectedTaskId(id)}
          onViewTrace={onViewTrace}
        />
      )}

      {/* Modals */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onViewTrace={onViewTrace}
          onOpenRecordRevision={onOpenRecordRevision}
          onClaim={(task) => setClaimTargetTask(task)}
          onSubmitResult={(task) => setSubmitTargetTask(task)}
          onTaskUpdated={loadData}
        />
      )}

      {showCreateModal && (
        <CreateTaskModal
          existingRecords={records}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => loadData()}
        />
      )}

      {claimTargetTask && (
        <ClaimTaskModal
          task={claimTargetTask}
          onClose={() => setClaimTargetTask(null)}
          onSuccess={() => loadData()}
        />
      )}

      {submitTargetTask && (
        <SubmitResultModal
          task={submitTargetTask}
          onClose={() => setSubmitTargetTask(null)}
          onSuccess={() => loadData()}
        />
      )}
    </div>
  );
}
