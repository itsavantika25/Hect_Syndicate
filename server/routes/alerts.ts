import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

function formatTMinus(expiresAt: string | null): string {
  if (!expiresAt) return 'T-MINUS --:--:--';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'T-MINUS 00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `T-MINUS ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

router.get('/', authMiddleware, (_req, res) => {
  const rows = db.prepare("SELECT * FROM alerts ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, id").all() as Array<Record<string, unknown>>;
  res.json(rows.map(r => ({ ...r, tMinus: formatTMinus(r.expires_at as string | null) })));
});

router.get('/intel-feed', authMiddleware, (_req, res) => {
  const rows = db.prepare('SELECT * FROM alerts ORDER BY id LIMIT 3').all() as Array<Record<string, unknown>>;
  res.json(rows.map(r => ({
    title: r.title,
    priority: r.priority,
    expiresAt: r.expires_at,
    tMinus: formatTMinus(r.expires_at as string | null),
    isCritical: r.priority === 'critical',
  })));
});

export default router;
