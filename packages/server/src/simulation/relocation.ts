/**
 * Agent Relocation Logic
 * Handles finding new hexes when current hex depletes
 */

import { prisma } from '../lib/prisma.js';
import { hexDistance, type HexCoord } from './hexMath.js';
import type { Biome } from '@prisma/client';

export interface HexWithResources {
  id: number;
  q: number;
  r: number;
  resourceType: string;
  resourceAmount: bigint;
  /** Visual terrain tier 0..6 (from the terrain sync). */
  elevation: number;
  /** Pit/cave-adjacent hex — gets the night 1.2x "deep" modifier. */
  isDeep: boolean;
  /** Biome band (from the terrain sync) — drives the Phase B weather modifier. */
  biome: Biome;
}

/**
 * Find the nearest hex with resources from current position
 *
 * From CONTEXT.md:
 * - "Nearest with resources" strategy
 * - Ties broken by lowest (q, r) for determinism
 *
 * @param currentHex - Current hex coordinates
 * @param excludeHexIds - Hexes to exclude (e.g., currently being mined by others)
 * @returns Nearest hex with resources, or null if none available
 */
export async function findNearestHexWithResources(
  currentHex: HexCoord,
  excludeHexIds: number[] = []
): Promise<HexWithResources | null> {
  // Query hexes with resources remaining
  const hexes = await prisma.hex.findMany({
    where: {
      resourceAmount: { gt: 0 },
      resourceType: { not: 'EMPTY' },
      id: { notIn: excludeHexIds },
    },
    select: {
      id: true,
      q: true,
      r: true,
      resourceType: true,
      resourceAmount: true,
      elevation: true,
      isDeep: true,
      biome: true,
    },
  });

  if (hexes.length === 0) return null;

  // Sort by distance, then by (q, r) for determinism
  hexes.sort((a, b) => {
    const distA = hexDistance(currentHex, a);
    const distB = hexDistance(currentHex, b);
    if (distA !== distB) return distA - distB;
    if (a.q !== b.q) return a.q - b.q;
    return a.r - b.r;
  });

  return hexes[0];
}

/**
 * Calculate travel time in ticks
 *
 * From CONTEXT.md:
 * - 1 tick per hex distance
 * - Minimum 1 tick even for adjacent hex (gives UI time to animate)
 */
export function calculateTravelTime(from: HexCoord, to: HexCoord): number {
  const distance = hexDistance(from, to);
  return Math.max(1, Math.ceil(distance));
}

/**
 * Get a hex by ID (for depletion checks)
 */
export async function getHexById(hexId: number): Promise<HexWithResources | null> {
  const hex = await prisma.hex.findUnique({
    where: { id: hexId },
    select: {
      id: true,
      q: true,
      r: true,
      resourceType: true,
      resourceAmount: true,
      elevation: true,
      isDeep: true,
      biome: true,
    },
  });

  return hex;
}

/**
 * Deduct resources from a hex
 */
export async function deductHexResources(
  hexId: number,
  amount: bigint
): Promise<{ newAmount: bigint; depleted: boolean }> {
  const hex = await prisma.hex.update({
    where: { id: hexId },
    data: {
      resourceAmount: { decrement: amount },
    },
    select: { resourceAmount: true },
  });

  return {
    newAmount: hex.resourceAmount,
    depleted: hex.resourceAmount <= 0n,
  };
}
