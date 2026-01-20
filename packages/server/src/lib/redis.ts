import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Regular client for get/set operations
export const redis = new Redis(redisUrl);

// Dedicated clients for pub/sub (subscriber mode blocks regular commands)
export const redisSub = new Redis(redisUrl);
export const redisPub = new Redis(redisUrl);
