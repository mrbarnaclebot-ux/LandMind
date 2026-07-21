import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { JWT_SECRET, SESSION_COOKIE_NAME } from '../lib/jwtSecret.js';

export interface AuthenticatedRequest extends Request {
  walletAddress?: string;
  userId?: string;
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
  const token = req.cookies?.[SESSION_COOKIE_NAME] ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'No session token' });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    req.walletAddress = payload.sub as string;
    req.userId = payload.userId as string;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/**
 * Middleware that requires authenticated session.
 * Sets both req.walletAddress and req.userId if valid.
 * Use this for protected routes that need user identity.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME] ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    req.walletAddress = payload.sub as string;
    req.userId = payload.userId as string;

    if (!req.userId) {
      res.status(401).json({ error: 'Invalid session - missing user ID' });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/**
 * Optional authentication middleware.
 * Sets req.walletAddress and req.userId if token is valid, otherwise leaves them undefined.
 * Does NOT reject requests without valid tokens - just passes through.
 * Use this for public routes that can optionally use user context.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME] ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    // No token - continue without user context
    next();
    return;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    req.walletAddress = payload.sub as string;
    req.userId = payload.userId as string;
  } catch {
    // Invalid token - continue without user context (don't reject)
  }

  next();
}
