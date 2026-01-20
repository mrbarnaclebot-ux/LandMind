import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    services: {
      database: 'unknown',
      cache: 'unknown',
    },
  };

  try {
    // Check PostgreSQL
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.services.database = 'healthy';

    // Check Redis
    const pong = await redis.ping();
    healthcheck.services.cache = pong === 'PONG' ? 'healthy' : 'unhealthy';

    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = 'ERROR';
    res.status(503).json(healthcheck);
  }
});

export default router;
