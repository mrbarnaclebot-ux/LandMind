import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from './authMiddleware.js';

/**
 * Core admin check: is the given user an ADMIN in the database?
 * Shared by the requireAdmin HTTP middleware and the socket admin gate so both
 * use identical logic.
 *
 * @param userId - User UUID (may be undefined)
 * @returns true if the user exists and has the ADMIN role
 */
export async function isUserAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role === 'ADMIN';
}

/**
 * Middleware that requires admin role.
 * Must be used after requireAuth middleware.
 */
export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!(await isUserAdmin(req.userId))) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * List of admin wallet pubkeys from environment variables.
 * These wallets are auto-promoted to ADMIN on first login.
 */
export const ADMIN_WALLETS: string[] = [
  process.env.ADMIN_WALLET_1,
  process.env.ADMIN_WALLET_2,
].filter((w): w is string => Boolean(w));

/**
 * Check if wallet should be auto-promoted to admin.
 */
export function isAdminWallet(walletPubkey: string): boolean {
  return ADMIN_WALLETS.includes(walletPubkey);
}
