import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import type { Server as SocketServer } from 'socket.io';

const router = Router();

function rowToOperative(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    loc: row.loc,
    sector: row.sector,
    status: row.status,
    force: row.force_level,
    compromised: Boolean(row.compromised),
    mapX: row.map_x,
    mapY: row.map_y,
  };
}

export function createOperativesRouter(io: SocketServer | null) {
  router.get('/', authMiddleware, (_req, res) => {
    const rows = db.prepare('SELECT * FROM operatives ORDER BY id').all() as Record<string, unknown>[];
    res.json(rows.map(rowToOperative));
  });

  router.get('/dashboard', authMiddleware, (_req, res) => {
    const rows = db.prepare('SELECT * FROM operatives ORDER BY id LIMIT 5').all() as Record<string, unknown>[];
    res.json(rows.map(rowToOperative));
  });

  router.patch('/:id/status', authMiddleware, (req, res) => {
    const { status } = req.body as { status?: string };
    if (!status) {
      res.status(400).json({ error: 'Status required' });
      return;
    }

    const result = db.prepare(`
      UPDATE operatives SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, req.params.id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Operative not found' });
      return;
    }

    const updated = db.prepare('SELECT * FROM operatives WHERE id = ?').get(req.params.id);
    const payload = rowToOperative(updated as Record<string, unknown>);
    io?.emit('operative:updated', payload);
    res.json(payload);
  });

  return router;
}

export default router;
