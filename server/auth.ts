import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { Socket } from 'socket.io';

const JWT_SECRET = process.env.JWT_SECRET || 'hcet-omega-9-syndicate-key';

export interface AuthPayload {
  userId: number;
  name: string;
  role: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  (req as Request & { user: AuthPayload }).user = payload;
  next();
}

export function socketAuth(socket: Socket): AuthPayload | null {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return null;
  return verifyToken(token);
}
