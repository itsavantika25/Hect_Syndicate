import express from 'express';
import cors from 'cors';
import type { Server as SocketServer } from 'socket.io';

import { initSchema, seedDatabase } from './db.js';
import authRouter from './routes/auth.js';
import { createOperativesRouter } from './routes/operatives.js';
import { createMissionsRouter } from './routes/missions.js';
import alertsRouter from './routes/alerts.js';
import { createRecruitsRouter } from './routes/recruits.js';
import { createSafeHousesRouter } from './routes/safeHouses.js';
import { createLogsRouter } from './routes/logs.js';

initSchema();
seedDatabase();

export function createApp(io: SocketServer | null = null, getOnlineCount: () => number = () => 0) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRouter);
  app.use('/api/operatives', createOperativesRouter(io));
  app.use('/api/missions', createMissionsRouter(io));
  app.use('/api/alerts', alertsRouter);
  app.use('/api/recruits', createRecruitsRouter(io));
  app.use('/api/safe-houses', createSafeHousesRouter(io));
  app.use('/api/logs', createLogsRouter(io, getOnlineCount));

  return app;
}
