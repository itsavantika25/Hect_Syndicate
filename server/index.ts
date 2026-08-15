import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { initSchema, seedDatabase } from './db.js';
import { socketAuth } from './auth.js';
import authRouter from './routes/auth.js';
import { createOperativesRouter } from './routes/operatives.js';
import { createMissionsRouter } from './routes/missions.js';
import alertsRouter from './routes/alerts.js';
import { createRecruitsRouter } from './routes/recruits.js';
import { createSafeHousesRouter } from './routes/safeHouses.js';
import { createLogsRouter } from './routes/logs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

initSchema();
seedDatabase();

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/operatives', createOperativesRouter(io));
app.use('/api/missions', createMissionsRouter(io));
app.use('/api/alerts', alertsRouter);
app.use('/api/recruits', createRecruitsRouter(io));
app.use('/api/safe-houses', createSafeHousesRouter(io));
app.use('/api/logs', createLogsRouter(io, () => onlineUsers.size));

app.use(express.static(ROOT));

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT, 'login.html'));
});

const onlineUsers = new Map<string, { name: string; role: string; connectedAt: string }>();

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

httpServer.listen(PORT, () => {
  console.log(`HCET Syndicate server running at http://localhost:${PORT}`);
});
