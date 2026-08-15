import { Router } from 'express';
import { db, getStats } from '../db.js';
import { authMiddleware } from '../auth.js';
import type { Server as SocketServer } from 'socket.io';

const router = Router();

export function createLogsRouter(io: SocketServer | null, getOnlineCount: () => number = () => 0) {
  router.get('/comms', authMiddleware, (_req, res) => {
    const rows = db.prepare('SELECT * FROM comms_logs ORDER BY id DESC LIMIT 50').all();
    res.json(rows.reverse());
  });

  router.get('/system', authMiddleware, (_req, res) => {
    const rows = db.prepare('SELECT * FROM system_logs ORDER BY id').all();
    res.json(rows);
  });

  router.delete('/comms', authMiddleware, (req, res) => {
    const user = (req as typeof req & { user: { name: string } }).user;
    db.prepare('DELETE FROM comms_logs').run();

    db.prepare('INSERT INTO comms_logs (type, tag, message, operative) VALUES (?, ?, ?, ?)').run(
      'sys', '[PURGE]', 'All logs cleared by operative order.', user.name
    );

    const log = db.prepare('SELECT * FROM comms_logs ORDER BY id DESC LIMIT 1').get();
    io?.emit('comms:purged', log);

    res.json({ purged: true, log });
  });

  router.post('/comms', authMiddleware, (req, res) => {
    const user = (req as typeof req & { user: { name: string } }).user;
    const { type, tag, message } = req.body as { type?: string; tag?: string; message?: string };

    if (!message?.trim()) {
      res.status(400).json({ error: 'Message required' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO comms_logs (type, tag, message, operative) VALUES (?, ?, ?, ?)
    `).run(type || 'sys', tag || '[CMD]', message.trim(), user.name);

    const log = db.prepare('SELECT * FROM comms_logs WHERE id = ?').get(result.lastInsertRowid);
    io?.emit('comms:new', log);
    res.status(201).json(log);
  });

  router.get('/stats', authMiddleware, (_req, res) => {
    res.json(getStats(getOnlineCount()));
  });

  return router;
}

export default router;
