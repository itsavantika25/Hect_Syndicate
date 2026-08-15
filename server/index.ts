import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { createApp } from './app.js';
import { socketAuth } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production (dist/server/index.js), ROOT is two levels up from __dirname.
// In dev (server/index.ts via tsx), ROOT is one level up.
// Using __dirname is reliable on Railway; process.cwd() can vary.
const ROOT = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(ROOT, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const onlineUsers = new Map<string, { name: string; role: string; connectedAt: string }>();

// ── Standard Socket.io + Express pattern ─────────────────────────────────────
// Pass the Express app directly into createServer() so it is the sole HTTP
// request listener. Socket.io then intercepts its /socket.io/* requests
// before they reach Express. The old pattern of createServer() +
// httpServer.on('request', app) caused BOTH to handle every request →
// ERR_HTTP_HEADERS_SENT on every Socket.io polling call.
const app = express();
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  allowEIO3: true,
  transports: ['polling', 'websocket'],
});

// Mount all /api/* routes
const apiApp = createApp(io, () => onlineUsers.size);
app.use(apiApp);

// Serve static files (HTML, CSS, JS) from the project root
app.use(express.static(ROOT));

// Default route → login page
app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT, 'login.html'));
});

// ── Socket.io auth middleware ─────────────────────────────────────────────────
io.use((socket, next) => {
  const user = socketAuth(socket);
  if (!user) {
    next(new Error('Unauthorized'));
    return;
  }
  socket.data.user = user;
  next();
});

// ── Socket.io connection handlers ────────────────────────────────────────────
io.on('connection', (socket) => {
  const user = socket.data.user as { userId: number; name: string; role: string };
  onlineUsers.set(socket.id, { name: user.name, role: user.role, connectedAt: new Date().toISOString() });

  io.emit('presence:update', {
    count: onlineUsers.size,
    users: Array.from(onlineUsers.values()),
  });

  socket.on('terminal:command', ({ command }: { command: string }) => {
    const cmd = command.trim().toLowerCase();
    const responses: Record<string, string> = {
      status: `All systems nominal. ${onlineUsers.size} operative(s) online.`,
      help: 'Commands: status · scan · ping · purge · encrypt · clear',
      scan: 'Running sector scan... 2 anomalies detected. Check vetting queue.',
      ping: 'Relay DELTA-9 responding. Latency: 12ms.',
      encrypt: 'Re-encrypting session. New session key generated.',
      purge: 'Log purge initiated. Confirm with: purge --confirm',
    };

    const message = responses[cmd] || `Unknown command: '${cmd}' — type 'help' for available commands.`;
    io.to(socket.id).emit('terminal:response', { command: cmd, message });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('presence:update', {
      count: onlineUsers.size,
      users: Array.from(onlineUsers.values()),
    });
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`HCET Syndicate server running on port ${PORT}`);
});
