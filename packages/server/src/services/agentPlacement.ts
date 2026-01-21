/**
 * Agent placement service
 * Assigns newly deployed agents to random available hexes
 */
import { prisma } from '../lib/prisma.js';

const MAX_AGENTS_PER_HEX = 20;

interface PlacementResult {
  hexId: number;
  q: number;
  r: number;
  resourceType: string;
}

/**
 * Find and assign a random hex for a new agent
 * Prefers hexes with resources and fewer agents
 */
export async function placeAgentOnHex(agentId: string): Promise<PlacementResult | null> {
  // Find hexes with resources and space for more agents
  const availableHexes = await prisma.hex.findMany({
    where: {
      resourceAmount: { gt: 0 },
      resourceType: { not: 'EMPTY' },
    },
    include: {
      _count: {
        select: { currentAgent: true },
      },
    },
  });

  // Filter to hexes with room
  const hexesWithRoom = availableHexes.filter(
    (h) => h._count.currentAgent < MAX_AGENTS_PER_HEX
  );

  if (hexesWithRoom.length === 0) {
    console.error('No available hexes for agent placement');
    return null;
  }

  // Weight by available space (prefer less crowded hexes)
  // Simple random for now - could weight by resource amount
  const randomIndex = Math.floor(Math.random() * hexesWithRoom.length);
  const selectedHex = hexesWithRoom[randomIndex];

  // Update agent with hex assignment
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      hexId: selectedHex.id,
      status: 'MINING',
    },
  });

  // Create mining state if not exists
  await prisma.miningState.upsert({
    where: { agentId },
    create: {
      agentId,
      gold: 0n,
      silver: 0n,
      copper: 0n,
      iron: 0n,
    },
    update: {},
  });

  return {
    hexId: selectedHex.id,
    q: selectedHex.q,
    r: selectedHex.r,
    resourceType: selectedHex.resourceType,
  };
}

/**
 * Get summary stats for a user's agents
 */
export async function getUserAgentStats(userId: string) {
  const agents = await prisma.agent.findMany({
    where: { ownerId: userId },
    include: { miningState: true },
  });

  const totalMined = agents.reduce(
    (acc, agent) => {
      if (agent.miningState) {
        acc.gold += agent.miningState.gold;
        acc.silver += agent.miningState.silver;
        acc.copper += agent.miningState.copper;
        acc.iron += agent.miningState.iron;
      }
      return acc;
    },
    { gold: 0n, silver: 0n, copper: 0n, iron: 0n }
  );

  const miningCount = agents.filter((a) => a.status === 'MINING').length;

  return {
    totalAgents: agents.length,
    miningAgents: miningCount,
    totalMined: {
      gold: totalMined.gold.toString(),
      silver: totalMined.silver.toString(),
      copper: totalMined.copper.toString(),
      iron: totalMined.iron.toString(),
    },
  };
}
