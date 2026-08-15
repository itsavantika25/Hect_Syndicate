import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import type { Server as SocketServer } from 'socket.io';

const router = Router();

export function createMissionsRouter(io: SocketServer) {
  router.get('/', authMiddleware, (_req, res) => {
    const rows = db.prepare('SELECT * FROM missions ORDER BY id').all();
    res.json(rows);
  });

  router.post('/', authMiddleware, (req, res) => {
    const user = (req as typeof req & { user: { name: string; role: string } }).user;
    if (user.role !== 'commander') {
      res.status(403).json({ error: 'Commander clearance required to initiate protocols' });
      return;
    }
    const { objective, assets } = req.body as { objective?: string; assets?: string[] };

    if (!objective?.trim()) {
      res.status(400).json({ error: 'Objective required' });
      return;
    }

    const count = (db.prepare('SELECT COUNT(*) as c FROM missions').get() as { c: number }).c + 1;
    const num = String(count).padStart(3, '0') + '_';
    const name = `Protocol ${num.slice(0, 3)}`;
    const assetList = (assets || []).join(', ') || 'Slicer_Unit';

    const result = db.prepare(`
      INSERT INTO missions (num, name, objective, coordinator, status, priority)
      VALUES (?, ?, ?, ?, 'in-progress', 'high')
    `).run(num, name, `OBJ: ${objective.trim()} // Assets: ${assetList}`, user.name.split(' ').map(n => n[0]).join('. ').toUpperCase());

    const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(result.lastInsertRowid);
    io.emit('mission:created', mission);

    db.prepare('INSERT INTO comms_logs (type, tag, message, operative) VALUES (?, ?, ?, ?)').run(
      'secure', '[PROTOCOL]', `New strategic protocol initiated: ${name}`, user.name
    );
    io.emit('comms:new', db.prepare('SELECT * FROM comms_logs ORDER BY id DESC LIMIT 1').get());

    res.status(201).json(mission);
  });

  return router;
}

export default router;
