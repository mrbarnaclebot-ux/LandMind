import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from project root (two levels up from packages/server/src)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health.js';
import devRouter from './routes/dev.js';
import authRouter from './routes/auth.js';
import { agentRouter } from './routes/agents.js';
import { earningsRouter } from './routes/earnings.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { adminRouter } from './routes/admin.js';
import worldRouter from './routes/world.js';
import { contractsRouter } from './routes/contracts.js';
import { hexesRouter, surveysRouter } from './routes/hexes.js';
import { setupSocket } from './lib/socket.js';
import { assertJwtSecret } from './lib/jwtSecret.js';
import { isFakeSolMode, logFakeSolModeWarning } from './lib/testMode.js';
import { startTickLoop, stopTickLoop } from './simulation/tickLoop.js';
import { flushToPostgres } from './cache/persistence.js';
import { redis, redisPub, redisSub } from './lib/redis.js';

// Fail hard at startup if the JWT secret is misconfigured in production.
assertJwtSecret();

/**
 * Warn (do NOT throw) at startup when optional Solana / on-chain configuration
 * is missing. The server boots and runs the full simulation + API with only
 * DATABASE_URL, REDIS_URL, JWT_SECRET and CORS_ORIGIN. On-chain features are
 * lazily initialized and only fail when actually invoked, so we surface the
 * degraded state here instead of crashing the process.
 */
function warnDegradedFeatures(): void {
  const degraded: string[] = [];

  if (!process.env.SERVER_WALLET_SECRET) {
    degraded.push(
      'SERVER_WALLET_SECRET missing — cNFT minting is DISABLED (agent deploy will fail to mint on-chain).'
    );
  }
  if (!process.env.MERKLE_TREE_ADDRESS) {
    degraded.push(
      'MERKLE_TREE_ADDRESS missing — cNFT minting is DISABLED (no Bubblegum tree to mint into).'
    );
  }
  if (!process.env.HELIUS_RPC_URL && !process.env.SOLANA_RPC_URL) {
    degraded.push(
      'HELIUS_RPC_URL / SOLANA_RPC_URL missing — falling back to public devnet RPC (rate-limited; on-chain reads/verification may be unreliable).'
    );
  }

  if (degraded.length > 0) {
    console.warn(
      '\n[startup] Running with DEGRADED on-chain features. ' +
        'The core simulation, WebSocket, auth and API are fully operational.\n' +
        degraded.map((d) => `  - ${d}`).join('\n') +
        '\n'
    );
  }
}

warnDegradedFeatures();

// Loud warning when fake-SOL test mode is enabled.
logFakeSolModeWarning();

const app = express();
const httpServer = createServer(app);
// Bind to the platform-provided PORT (Railway injects this) and 0.0.0.0 so the
// container is reachable from outside. Fall back to 3001 for local dev.
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize Socket.io (must be before middleware that might interfere)
const io = setupSocket(httpServer);

// Expose the io instance to route handlers via req.app.get('io').
// (Route handlers prefer getIO() from lib/socket, but this keeps the app
// wiring explicit and available.)
app.set('io', io);

// Support comma-separated CORS_ORIGIN; never use '*' with credentials.
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Middleware
app.use(helmet());
app.use(cors({
  origin: corsOrigins,
  credentials: true  // Required for cookies
}));
app.use(cookieParser());
app.use(express.json());

// --- Rate limiting ---------------------------------------------------------
// Strict limiter for auth endpoints (brute-force / nonce abuse protection).
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 requests/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// Moderate limiter for sensitive money/agent endpoints.
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 requests/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// General fallback limiter for the whole API surface.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300, // 300 requests/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

app.use(generalLimiter);

// Public runtime config — always available. The client uses this to switch UI
// into fake-SOL test mode. Never leaks secrets; only advertises the mode/network.
app.get('/api/config', (_req, res) => {
  res.json({ fakeSolMode: isFakeSolMode(), network: 'devnet' });
});

// Routes
app.use('/health', healthRouter);
app.use('/auth', authLimiter, authRouter);
app.use('/api/earnings/claim', sensitiveLimiter);
app.use('/api/agents', sensitiveLimiter, agentRouter);
app.use('/api/earnings', earningsRouter);
app.use('/api/leaderboard', leaderboardRouter);
// Public world clock — no auth, cheap pure function. Used for initial HUD load.
app.use('/api/world', worldRouter);
// Phase D (Engagement): daily contracts + prospecting. Both auth'd; the
// sensitiveLimiter caps request rate (surveys also have a 5-min per-user cooldown).
app.use('/api/contracts', sensitiveLimiter, contractsRouter);
app.use('/api/hexes', sensitiveLimiter, hexesRouter);
app.use('/api/surveys', sensitiveLimiter, surveysRouter);
app.use('/admin', adminRouter);

// Dev routes (development only) — never mounted in production.
if (process.env.NODE_ENV === 'development') {
  app.use('/dev', devRouter);
}

// Graceful shutdown handler
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Stop tick loop
  stopTickLoop();

  // Flush to PostgreSQL
  console.log('Flushing state to PostgreSQL...');
  await flushToPostgres();

  // Close Redis connections
  console.log('Closing Redis connections...');
  await redis.quit();
  await redisPub.quit();
  await redisSub.quit();

  // Close Socket.io
  console.log('Closing WebSocket server...');
  io.close();

  // Close HTTP server
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// IMPORTANT: Use httpServer.listen(), NOT app.listen()
// Socket.io requires access to the HTTP server instance
httpServer.listen(PORT, HOST, async () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log(`WebSocket: ws://${HOST}:${PORT}`);

  // Start tick loop after server is ready
  await startTickLoop();
});

export { io };
