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
import healthRouter from './routes/health.js';
import devRouter from './routes/dev.js';
import authRouter from './routes/auth.js';
import { agentRouter } from './routes/agents.js';
import { earningsRouter } from './routes/earnings.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { adminRouter } from './routes/admin.js';
import { setupSocket } from './lib/socket.js';
import { startTickLoop, stopTickLoop } from './simulation/tickLoop.js';
import { flushToPostgres } from './cache/persistence.js';
import { redis, redisPub, redisSub } from './lib/redis.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.io (must be before middleware that might interfere)
const io = setupSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true  // Required for cookies
}));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/api/agents', agentRouter);
app.use('/api/earnings', earningsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/admin', adminRouter);

// Dev routes (development only)
app.use('/dev', devRouter);

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
httpServer.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket: ws://localhost:${PORT}`);

  // Start tick loop after server is ready
  await startTickLoop();
});

export { io };
