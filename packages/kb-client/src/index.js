export class KBError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'KBError';
    this.code = code;
    this.status = status;
  }
}

export class KBClient {
  constructor({ baseUrl, token, tool = 'kb-client' }) {
    if (!baseUrl) {
      throw new Error('baseUrl is required');
    }
    if (!token) {
      throw new Error('token is required');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
    this.tool = tool;
  }

  async #request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      ...(this.tool ? { 'X-KB-Tool': this.tool } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(url, {
      ...options,
      headers
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body.error || res.statusText || `Request failed with status ${res.status}`;
      const code = body.code || 'HTTP_ERROR';
      throw new KBError(message, code, res.status);
    }

    // 204 No Content
    if (res.status === 204) {
      return null;
    }

    return await res.json();
  }

  async readRecord(id, rev) {
    if (rev !== undefined && rev !== null) {
      return await this.#request(`/api/records/${encodeURIComponent(id)}/revisions/${encodeURIComponent(rev)}`);
    }
    return await this.#request(`/api/records/${encodeURIComponent(id)}`);
  }

  async claimTask(taskId) {
    return await this.#request(`/api/tasks/${encodeURIComponent(taskId)}/claim`, {
      method: 'POST'
    });
  }

  async submitResult(taskId, { attempt = 1, body, citations = [], fencingToken, baseRevisions }) {
    return await this.#request(`/api/tasks/${encodeURIComponent(taskId)}/result`, {
      method: 'POST',
      body: JSON.stringify({
        attempt,
        body,
        citations,
        fencingToken,
        baseRevisions
      })
    });
  }

  async getTaskContext(taskId) {
    return await this.#request(`/api/tasks/${encodeURIComponent(taskId)}/context`);
  }

  async resumeTask(taskId) {
    return await this.#request(`/api/tasks/${encodeURIComponent(taskId)}/resume`, {
      method: 'POST'
    });
  }

  async listTasks(status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return await this.#request(`/api/tasks${query}`);
  }
}
