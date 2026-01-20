/**
 * Database Seed Script
 * Creates initial test data for development
 *
 * Run with: npm run --workspace=@landmind/server db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test user
  const user = await prisma.user.upsert({
    where: { walletPubkey: 'test-wallet-pubkey-123' },
    create: { walletPubkey: 'test-wallet-pubkey-123' },
    update: {},
  });
  console.log(`Created user: ${user.id}`);

  // Create hexes in a radius-10 hex-shaped region
  const radius = 10;
  const resourceTypes = ['GOLD', 'SILVER', 'COPPER', 'IRON'] as const;
  const hexes: Array<{
    q: number;
    r: number;
    resourceType: typeof resourceTypes[number];
    resourceAmount: bigint;
  }> = [];

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const typeIndex = Math.abs((q * 7 + r * 13) % 4);
      hexes.push({
        q,
        r,
        resourceType: resourceTypes[typeIndex],
        resourceAmount: BigInt(1000000),
      });
    }
  }

  // Delete existing hexes and recreate
  await prisma.hex.deleteMany({});
  await prisma.hex.createMany({ data: hexes });
  console.log(`Created ${hexes.length} hexes`);

  // Create a test agent at origin
  const originHex = await prisma.hex.findUnique({
    where: { q_r: { q: 0, r: 0 } },
  });

  if (originHex) {
    const agent = await prisma.agent.upsert({
      where: { id: 'test-agent-1' },
      create: {
        id: 'test-agent-1',
        ownerId: user.id,
        hexId: originHex.id,
        status: 'MINING',
        miningState: {
          create: {
            gold: 0,
            silver: 0,
            copper: 0,
            iron: 0,
          },
        },
      },
      update: {
        hexId: originHex.id,
        status: 'MINING',
      },
    });
    console.log(`Created agent: ${agent.id}`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
