export const TOKEN_STORAGE_KEY = 'team_kb_token';

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
}

export function setStoredToken(token) {
  if (token) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(path, {
    ...options,
    headers
  });

  if (res.status === 401) {
    setStoredToken('');
    const err = new Error('Session expired or unauthorized. Please log in.');
    err.status = 401;
    err.code = 'UNAUTHENTICATED';
    throw err;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.code = data.code || 'HTTP_ERROR';
    throw err;
  }

  return data;
}

export const api = {
  getMe: () => apiRequest('/api/me'),
  getTasks: (status) => apiRequest(`/api/tasks${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getTask: (id) => apiRequest(`/api/tasks/${encodeURIComponent(id)}`),
  getTaskContext: (id) => apiRequest(`/api/tasks/${encodeURIComponent(id)}/context`),
  getRecords: () => apiRequest('/api/records'),
  getRecord: (id) => apiRequest(`/api/records/${encodeURIComponent(id)}`),
  getRecordRevisions: (id) => apiRequest(`/api/records/${encodeURIComponent(id)}/revisions`),
  getRecordRevision: (id, rev) => apiRequest(`/api/records/${encodeURIComponent(id)}/revisions/${encodeURIComponent(rev)}`),
  getFlags: (status) => apiRequest(`/api/flags${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getFlag: (id) => apiRequest(`/api/flags/${encodeURIComponent(id)}`),
  approveFlag: (id, note) => apiRequest(`/api/flags/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ note })
  }),
  rejectFlag: (id, note) => apiRequest(`/api/flags/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note })
  }),
  getTrace: (taskId) => apiRequest(`/api/trace/${encodeURIComponent(taskId)}`),
  getEvents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/api/events${query ? `?${query}` : ''}`);
  }
};
