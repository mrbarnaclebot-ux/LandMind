import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { redis } from '../lib/redis.js';
import { verifySignature } from '../lib/solana.js';
import { prisma } from '../lib/prisma.js';
import { isAdminWallet } from '../middleware/adminAuth.js';
import { JWT_SECRET, SESSION_COOKIE_NAME } from '../lib/jwtSecret.js';

const router = Router();
const NONCE_TTL = 300; // 5 minutes
const SESSION_DURATION = '24h';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * GET /auth/nonce?address=<wallet_address>
 * Generate a one-time nonce for SIWS authentication
 */
router.get('/nonce', async (req: Request, res: Response) => {
  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    res.status(400).json({ error: 'Address query parameter required' });
    return;
  }

  // Validate it looks like a Solana address (32-44 base58 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    res.status(400).json({ error: 'Invalid Solana address format' });
    return;
  }

  // Generate cryptographically secure nonce
  const nonce = crypto.randomBytes(16).toString('base64url');

  // Store in Redis with TTL (one-time use)
  await redis.set(`nonce:${address}`, nonce, 'EX', NONCE_TTL);

  // SIWS-compliant message format
  const issuedAt = new Date().toISOString();
  const message = [
    'landmind.app wants you to sign in with your Solana account:',
    address,
    '',
    'Sign in to LandMind',
    '',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`
  ].join('\n');

  res.json({ nonce, message });
});

/**
 * POST /auth/verify
 * Verify wallet signature and issue JWT session token
 */
router.post('/verify', async (req: Request, res: Response) => {
  const { address, signature, message, nonce } = req.body;

  if (!address || !signature || !message || !nonce) {
    res.status(400).json({ error: 'Missing required fields: address, signature, message, nonce' });
    return;
  }

  // 1. Verify nonce exists and matches (prevents replay attacks)
  const storedNonce = await redis.get(`nonce:${address}`);
  if (!storedNonce || storedNonce !== nonce) {
    res.status(401).json({ error: 'Invalid or expired nonce' });
    return;
  }

  // 2. Delete nonce immediately (one-time use)
  await redis.del(`nonce:${address}`);

  // 3. Verify signature
  const isValid = verifySignature(message, signature, address);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // 4. Create or get user in database
  let user = await prisma.user.upsert({
    where: { walletPubkey: address },
    update: { updatedAt: new Date() },
    create: { walletPubkey: address }
  });

  // 5. Auto-promote admin wallets
  if (isAdminWallet(address) && user.role !== 'ADMIN') {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });
  }

  // 6. Issue JWT
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({
    sub: address,
    userId: user.id,
    iat: now
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(SESSION_DURATION)
    .sign(JWT_SECRET);

  // 7. Set httpOnly cookie
  res.cookie(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION_MS
  });

  res.json({
    success: true,
    address,
    userId: user.id,
    expiresAt: (now * 1000) + SESSION_DURATION_MS
  });
});

/**
 * POST /auth/logout
 * Clear session cookie
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ success: true });
});

/**
 * GET /auth/session
 * Check current session status (requires valid token)
 */
router.get('/session', async (req: Request, res: Response) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME] ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.json({ authenticated: false });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    res.json({
      authenticated: true,
      address: payload.sub,
      userId: payload.userId,
      expiresAt: (payload.exp ?? 0) * 1000
    });
  } catch {
    res.json({ authenticated: false });
  }
});

export default router;
