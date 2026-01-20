import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production'
);

export interface AuthenticatedRequest extends Request {
  walletAddress?: string;
}

/**
 * Middleware to verify JWT session token from cookie or Authorization header.
 * Sets req.walletAddress if valid.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.session ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'No session token' });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    req.walletAddress = payload.sub as string;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}
