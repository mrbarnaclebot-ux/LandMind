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
import healthRouter from './routes/health.js';
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
app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRouter);

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
