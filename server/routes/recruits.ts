import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import type { Server as SocketServer } from 'socket.io';

const router = Router();

export function createRecruitsRouter(io: SocketServer | null) {
  router.get('/', authMiddleware, (_req, res) => {
    const rows = db.prepare('SELECT * FROM recruits ORDER BY id').all();
    res.json(rows);
  });

  router.post('/', authMiddleware, (req, res) => {
    const user = (req as typeof req & { user: { name: string } }).user;
    const { requestId, location, forcePotential } = req.body as {
      requestId?: string;
      location?: string;
      forcePotential?: number;
    };

    if (!requestId?.trim() || !location?.trim()) {
      res.status(400).json({ error: 'Request ID and location required' });
      return;
    }

    const existing = db.prepare('SELECT id FROM recruits WHERE request_id = ?').get(requestId.toUpperCase());
    if (existing) {
      res.status(409).json({ error: 'Request ID already exists' });
      return;
    }

    const force = Math.min(5, Math.max(1, forcePotential || Math.floor(Math.random() * 3) + 2));

    const result = db.prepare(`
      INSERT INTO recruits (request_id, location, force_potential, status, submitted_by)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(requestId.toUpperCase(), location.toUpperCase(), force, user.name);

    const recruit = db.prepare('SELECT * FROM recruits WHERE id = ?').get(result.lastInsertRowid);
    io?.emit('recruit:created', recruit);

    db.prepare('INSERT INTO comms_logs (type, tag, message, operative) VALUES (?, ?, ?, ?)').run(
      'secure', '[REQUEST]', `New vetting request: ${requestId.toUpperCase()} from ${location.toUpperCase()}.`, user.name
    );
    io?.emit('comms:new', db.prepare('SELECT * FROM comms_logs ORDER BY id DESC LIMIT 1').get());

    db.prepare('INSERT INTO alerts (title, description, priority, icon, expires_at) VALUES (?, ?, ?, ?, ?)').run(
      'NEW RECRUIT SIGNAL DETECTED',
      `Vetting request ${requestId.toUpperCase()} submitted from ${location.toUpperCase()}.`,
      'low', 'info', new Date(Date.now() + 24 * 3600000).toISOString()
    );
    io?.emit('alert:created', db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT 1').get());

    res.status(201).json(recruit);
  });

  router.patch('/:id/status', authMiddleware, (req, res) => {
    const { status } = req.body as { status?: string };
    if (!status) {
      res.status(400).json({ error: 'Status required' });
      return;
    }

    const result = db.prepare('UPDATE recruits SET status = ? WHERE id = ?').run(status, req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Recruit not found' });
      return;
    }

    const recruit = db.prepare('SELECT * FROM recruits WHERE id = ?').get(req.params.id);
    io?.emit('recruit:updated', recruit);
    res.json(recruit);
  });

  router.post('/decrypt-all', authMiddleware, (req, res) => {
    const user = (req as typeof req & { user: { name: string; role: string } }).user;
    if (user.role !== 'commander') {
      res.status(403).json({ error: 'Commander clearance required to decrypt vetting queue' });
      return;
    }
    db.prepare("UPDATE recruits SET status = 'secure' WHERE status = 'pending'").run();

    const recruits = db.prepare('SELECT * FROM recruits ORDER BY id').all();
    io?.emit('recruits:sync', recruits);

    db.prepare('INSERT INTO comms_logs (type, tag, message, operative) VALUES (?, ?, ?, ?)').run(
      'secure', '[DECRYPT]', 'All pending vetting requests decrypted and cleared.', user.name
    );
    io?.emit('comms:new', db.prepare('SELECT * FROM comms_logs ORDER BY id DESC LIMIT 1').get());

    res.json({ recruits });
  });

  return router;
}

export default router;
