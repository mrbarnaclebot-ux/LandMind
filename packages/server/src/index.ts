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

// IMPORTANT: Use httpServer.listen(), NOT app.listen()
// Socket.io requires access to the HTTP server instance
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
});

export { io };
