import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { signToken, verifyToken } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { name, password, code } = req.body as { name?: string; password?: string; code?: string };

  if (!name?.trim() || !password || !/^[0-9]{6}$/.test(code || '')) {
    res.status(400).json({ error: 'Invalid credentials format' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE LOWER(name) = LOWER(?)').get(name.trim()) as
    | { id: number; name: string; password_hash: string; role: string }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'ACCESS DENIED: INVALID SECURITY TOKEN OR KEY SIGNATURE.' });
    return;
  }

  const token = signToken({ userId: user.id, name: user.name, role: user.role });

  db.prepare('INSERT INTO system_logs (type, tag, message) VALUES (?, ?, ?)').run(
    'sys',
    '[AUTH]',
    `${user.name} authenticated and joined the syndicate network.`
  );

  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  res.json({ user: payload });
});

export default router;
