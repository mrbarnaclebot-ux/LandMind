import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { LANDMIND_PROGRAM_ID } from '../lib/programId.js';
import { TREASURY_SEED } from '../lib/pdaSeeds.js';

export interface PlatformMetrics {
  // User metrics
  totalUsers: number;
  activeUsers: number;  // Users with agents mining
  newUsersToday: number;

  // Agent metrics
  totalAgents: number;
  miningAgents: number;
  idleAgents: number;

  // Economy metrics
  treasuryBalance: number;  // lamports
  totalClaimed: number;     // lamports
  totalDeposits: number;    // lamports

  // Performance metrics
  redisLatency: number;     // ms
  dbLatency: number;        // ms
  rpcLatency: number;       // ms

  // Real-time
  resourcesPerMinute: number;
  connectionsCount: number;

  timestamp: number;
}

function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

export async function gatherMetrics(): Promise<PlatformMetrics> {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Parallel queries for efficiency
  const [
    totalUsers,
    newUsersToday,
    agentStats,
    treasuryBalance,
    claimStats,
    depositStats,
    connectionsCount,
    redisLatency,
    dbLatency,
    rpcLatency,
  ] = await Promise.all([
    // Total users
    prisma.user.count(),

    // New users today
    prisma.user.count({
      where: { createdAt: { gte: todayStart } },
    }),

    // Agent stats
    prisma.agent.groupBy({
      by: ['status'],
      _count: true,
    }),

    // Treasury balance
    getTreasuryBalance(),

    // Total claimed
    prisma.claim.aggregate({
      _sum: { amount: true },
    }),

    // Total deposits
    prisma.feeDeposit.aggregate({
      _sum: { amount: true },
    }),

    // Socket.io connections (from Redis)
    getConnectionsCount(),

    // Latency checks
    measureRedisLatency(),
    measureDbLatency(),
    measureRpcLatency(),
  ]);

  // Parse agent stats
  const totalAgents = agentStats.reduce((sum, s) => sum + s._count, 0);
  const miningAgents = agentStats.find(s => s.status === 'MINING')?._count ?? 0;
  const idleAgents = agentStats.find(s => s.status === 'IDLE')?._count ?? 0;

  // Active users = users with mining agents
  const activeUsers = await prisma.user.count({
    where: {
      agents: {
        some: { status: 'MINING' },
      },
    },
  });

  // Resources per minute (estimate from recent mining states)
  const resourcesPerMinute = await estimateResourceRate();

  return {
    totalUsers,
    activeUsers,
    newUsersToday,
    totalAgents,
    miningAgents,
    idleAgents,
    treasuryBalance,
    totalClaimed: Number(claimStats._sum.amount ?? 0),
    totalDeposits: Number(depositStats._sum.amount ?? 0),
    redisLatency,
    dbLatency,
    rpcLatency,
    resourcesPerMinute,
    connectionsCount,
    timestamp: now,
  };
}

async function getTreasuryBalance(): Promise<number> {
  try {
    const treasuryPDA = PublicKey.findProgramAddressSync(
      [Buffer.from(TREASURY_SEED)],
      LANDMIND_PROGRAM_ID
    )[0];
    const connection = getConnection();
    return await connection.getBalance(treasuryPDA);
  } catch {
    return 0;
  }
}

async function getConnectionsCount(): Promise<number> {
  try {
    return Number(await redis.scard('active_users')) || 0;
  } catch {
    return 0;
  }
}

async function measureRedisLatency(): Promise<number> {
  const start = Date.now();
  await redis.ping();
  return Date.now() - start;
}

async function measureDbLatency(): Promise<number> {
  const start = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return Date.now() - start;
}

async function measureRpcLatency(): Promise<number> {
  const start = Date.now();
  try {
    const connection = getConnection();
    await connection.getSlot();
    return Date.now() - start;
  } catch {
    return -1;  // Error
  }
}

async function estimateResourceRate(): Promise<number> {
  // Get mining count and multiply by tick rate
  const miningCount = await prisma.agent.count({ where: { status: 'MINING' } });
  // Average resources per agent per minute (based on tick rates)
  // GOLD:10, SILVER:20, COPPER:35, IRON:50 average per tick
  // 12 ticks per minute (5-second intervals)
  const avgPerAgentPerMinute = ((10 + 20 + 35 + 50) / 4) * 12;
  return miningCount * avgPerAgentPerMinute;
}
