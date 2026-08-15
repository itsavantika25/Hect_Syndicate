

const API_BASE = '';
const TOKEN_KEY = 'hcet_token';
const USER_KEY = 'hcet_user';

let socket = null;
const listeners = new Map();
let lastPresence = null;

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function getUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function isAuthenticated() {
  return Boolean(getToken());
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem('hcet_session');
    window.location.href = 'login.html';
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

async function login(name, password, code) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, password, code }),
  });

  sessionStorage.setItem(TOKEN_KEY, data.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
  sessionStorage.setItem('hcet_session', 'authenticated');
  sessionStorage.setItem('hcet_operative', data.user.name.toLowerCase());
  return data;
}

function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  sessionStorage.clear();
  window.location.href = 'login.html';
}

function connectSocket() {
  if (socket?.connected) return socket;

  const token = getToken();
  if (!token) return null;

  // Railway's proxy doesn't support WebSocket upgrades reliably.
  // Use polling transport which works through any HTTP reverse proxy.
  socket = io({
    auth: { token },
    transports: ['polling'],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    emit('socket:connected');
    if (lastPresence) emit('presence:update', lastPresence);
  });

  socket.on('connect_error', (err) => {
    console.warn('[HCET] Socket connect error:', err.message);
    // Only redirect on auth errors, not transport errors
    if (err.message === 'Unauthorized') {
      sessionStorage.removeItem(TOKEN_KEY);
      window.location.href = 'login.html';
    }
  });

  const events = [
    'operative:updated',
    'mission:created',
    'recruit:created',
    'recruit:updated',
    'recruits:sync',
    'comms:new',
    'comms:purged',
    'alert:created',
    'presence:update',
    'terminal:response',
  ];

  events.forEach(evt => {
    socket.on(evt, (payload) => emit(evt, payload));
  });

  return socket;
}

function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

function emit(event, payload) {
  if (event === 'presence:update') lastPresence = payload;
  listeners.get(event)?.forEach(fn => fn(payload));
}

function sendTerminalCommand(command) {
  socket?.emit('terminal:command', { command });
}

window.HCET = {
  api,
  login,
  disconnect,
  connectSocket,
  sendTerminalCommand,
  on,
  getToken,
  getUser,
  isAuthenticated,
  getOperatives: () => api('/api/operatives'),
  getDashboardOperatives: () => api('/api/operatives/dashboard'),
  getMissions: () => api('/api/missions'),
  createMission: (objective, assets) => api('/api/missions', { method: 'POST', body: JSON.stringify({ objective, assets }) }),
  getAlerts: () => api('/api/alerts'),
  getIntelFeed: () => api('/api/alerts/intel-feed'),
  getRecruits: () => api('/api/recruits'),
  createRecruit: (requestId, location) => api('/api/recruits', { method: 'POST', body: JSON.stringify({ requestId, location }) }),
  decryptAllRecruits: () => api('/api/recruits/decrypt-all', { method: 'POST' }),
  getSafeHouses: () => api('/api/safe-houses'),
  routeToSafeHouse: (id) => api(`/api/safe-houses/${id}/route`, { method: 'POST' }),
  getCommsLogs: () => api('/api/logs/comms'),
  getSystemLogs: () => api('/api/logs/system'),
  purgeCommsLogs: () => api('/api/logs/comms', { method: 'DELETE' }),
  getStats: () => api('/api/logs/stats'),
  updateOperativeStatus: (id, status) => api(`/api/operatives/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateRecruitStatus: (id, status) => api(`/api/recruits/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};
