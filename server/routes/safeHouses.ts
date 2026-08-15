import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import type { Server as SocketServer } from 'socket.io';

const router = Router();

export function createSafeHousesRouter(io: SocketServer | null) {
  router.get('/', authMiddleware, (_req, res) => {
    const rows = db.prepare('SELECT * FROM safe_houses ORDER BY id').all();
    res.json(rows);
  });

  router.post('/:id/route', authMiddleware, (req, res) => {
    const user = (req as typeof req & { user: { name: string } }).user;
    const house = db.prepare('SELECT * FROM safe_houses WHERE id = ?').get(req.params.id) as
      | { id: number; name: string; routable: number }
      | undefined;

    if (!house) {
      res.status(404).json({ error: 'Safe house not found' });
      return;
    }

    if (!house.routable) {
      res.status(403).json({ error: 'Safe house is locked' });
      return;
    }

    const msg = `Secure route to ${house.name} calculated. Avoid Sector 4. ETA: 02:14:00.`;
    db.prepare('INSERT INTO comms_logs (type, tag, message, operative) VALUES (?, ?, ?, ?)').run(
      'secure', '[ROUTE]', msg, user.name
    );

    const log = db.prepare('SELECT * FROM comms_logs ORDER BY id DESC LIMIT 1').get();
    io?.emit('comms:new', log);

    res.json({ message: msg, log });
  });

  return router;
}

export default router;
