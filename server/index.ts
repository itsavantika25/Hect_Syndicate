import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import fs from 'fs';

import { createApp } from './app.js';
import { socketAuth } from './auth.js';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const onlineUsers = new Map<string, { name: string; role: string; connectedAt: string }>();

const httpServer = createServer();
const io = new SocketServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  // Railway's reverse proxy doesn't support WebSocket upgrades.
  // Allow EIO3 clients and keep transports broad for compatibility.
  allowEIO3: true,
  transports: ['polling', 'websocket'],
});

const app = createApp(io, () => onlineUsers.size);
httpServer.on('request', app);

app.use(express.static(ROOT));

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT, 'login.html'));
});

io.use((socket, next) => {
  const user = socketAuth(socket);
  if (!user) {
    next(new Error('Unauthorized'));
    return;
  }
  socket.data.user = user;
  next();
});

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

const PORT = Number(process.env.PORT) || 3000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`HCET Syndicate server running on port ${PORT}`);
});
