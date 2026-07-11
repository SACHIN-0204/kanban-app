// Thin wrapper around fetch so every request handles JSON + auth + errors consistently.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  signup: (name, email, password) =>
    request('/auth/signup', { method: 'POST', body: { name, email, password } }),

  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),

  me: (token) => request('/auth/me', { token }),

  listBoards: (token) => request('/boards', { token }),

  createBoard: (token, name) => request('/boards', { method: 'POST', token, body: { name } }),

  getBoard: (token, boardId) => request(`/boards/${boardId}`, { token }),

  deleteBoard: (token, boardId) => request(`/boards/${boardId}`, { method: 'DELETE', token }),

  addMember: (token, boardId, email) =>
    request(`/boards/${boardId}/members`, { method: 'POST', token, body: { email } }),

  createColumn: (token, boardId, name, socketId) =>
    request(`/boards/${boardId}/columns`, { method: 'POST', token, body: { name, socketId } }),

  updateColumn: (token, columnId, updates, socketId) =>
    request(`/columns/${columnId}`, { method: 'PATCH', token, body: { ...updates, socketId } }),

  deleteColumn: (token, columnId, socketId) =>
    request(`/columns/${columnId}`, { method: 'DELETE', token, body: { socketId } }),

  createCard: (token, boardId, columnId, title, socketId) =>
    request(`/boards/${boardId}/columns/${columnId}/cards`, {
      method: 'POST',
      token,
      body: { title, socketId },
    }),

  updateCard: (token, cardId, updates, socketId) =>
    request(`/cards/${cardId}`, { method: 'PATCH', token, body: { ...updates, socketId } }),

  moveCard: (token, cardId, toColumnId, toPosition, socketId) =>
    request(`/cards/${cardId}/move`, {
      method: 'PATCH',
      token,
      body: { toColumnId, toPosition, socketId },
    }),

  deleteCard: (token, cardId, socketId) =>
    request(`/cards/${cardId}`, { method: 'DELETE', token, body: { socketId } }),
};
