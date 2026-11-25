export const TOKEN_STORAGE_KEY = 'team_kb_token';
export const TOOL_STORAGE_KEY = 'team_kb_active_tool';

export const SEED_USERS = [
  {
    userId: 'alice',
    name: 'Alice Lead',
    role: 'lead',
    token: 'token_alice_lead_dev_secret_key_123',
    tool: 'claude-code',
    description: 'Lead author · Can create briefs, revise decisions, approve flags & resume tasks'
  },
  {
    userId: 'bob',
    name: 'Bob Developer',
    role: 'dev',
    token: 'token_bob_dev_secret_key_456',
    tool: 'antigravity',
    description: 'Dev agent · Claims tasks & submits agent results; restricted from unauthorized edits'
  },
  {
    userId: 'carol',
    name: 'Carol Reviewer',
    role: 'reviewer',
    token: 'token_carol_reviewer_secret_key_789',
    tool: 'ui',
    description: 'Reviewer · Inspects diffs, evaluates blast radius, approves/rejects stale flags'
  }
];

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

export function setStoredToken(token) {
  if (token) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getStoredTool() {
  return sessionStorage.getItem(TOOL_STORAGE_KEY) || 'api';
}

export function setStoredTool(tool) {
  if (tool) {
    sessionStorage.setItem(TOOL_STORAGE_KEY, tool);
  } else {
    sessionStorage.removeItem(TOOL_STORAGE_KEY);
  }
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken();
  const tool = options.tool || getStoredTool();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(tool ? { 'X-KB-Tool': tool } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(path, {
    ...options,
    headers
  });

  if (res.status === 401) {
    setStoredToken('');
    const err = new Error('Session expired or unauthorized. Please sign in again.');
    err.status = 401;
    err.code = 'UNAUTHENTICATED';
    throw err;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'API Request failed');
    err.status = res.status;
    err.code = data.code || 'HTTP_ERROR';
    err.details = data;
    throw err;
  }

  return data;
}

export const api = {
  // Authentication
  getMe: (tool) => apiRequest('/api/me', { tool }),

  // Tasks
  getTasks: (status) => apiRequest(`/api/tasks${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getTask: (id) => apiRequest(`/api/tasks/${encodeURIComponent(id)}`),
  createTask: (data, tool) => apiRequest('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
    tool
  }),
  claimTask: (id, tool) => apiRequest(`/api/tasks/${encodeURIComponent(id)}/claim`, {
    method: 'POST',
    tool
  }),
  submitResult: (id, data, tool) => apiRequest(`/api/tasks/${encodeURIComponent(id)}/result`, {
    method: 'POST',
    body: JSON.stringify(data),
    tool
  }),
  getTaskContext: (id) => apiRequest(`/api/tasks/${encodeURIComponent(id)}/context`),
  resumeTask: (id, tool) => apiRequest(`/api/tasks/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
    tool
  }),

  // Records & Revisions
  getRecords: () => apiRequest('/api/records'),
  getRecord: (id) => apiRequest(`/api/records/${encodeURIComponent(id)}`),
  createRecord: (data, tool) => apiRequest('/api/records', {
    method: 'POST',
    body: JSON.stringify(data),
    tool
  }),
  updateRecord: (id, data, tool) => apiRequest(`/api/records/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    tool
  }),
  getRecordRevisions: (id) => apiRequest(`/api/records/${encodeURIComponent(id)}/revisions`),
  getRecordRevision: (id, rev) => apiRequest(`/api/records/${encodeURIComponent(id)}/revisions/${encodeURIComponent(rev)}`),

  // Flags & Approvals
  getFlags: (status) => apiRequest(`/api/flags${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getFlag: (id) => apiRequest(`/api/flags/${encodeURIComponent(id)}`),
  approveFlag: (id, note, tool) => apiRequest(`/api/flags/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note }),
    tool
  }),
  rejectFlag: (id, note, tool) => apiRequest(`/api/flags/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
    tool
  }),

  // Provenance Trace
  getTrace: (taskId) => apiRequest(`/api/trace/${encodeURIComponent(taskId)}`),

  // Events & Audit
  getEvents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/api/events${query ? `?${query}` : ''}`);
  }
};
