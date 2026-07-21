/**
 * Terrain sync — populate hexes.elevation + hexes.is_deep from the CLIENT
 * terrain generator (single source of truth for the world's shape).
 *
 * The client renders columns/pits/caves from `generateWorld(radius)`; the server
 * needs the same per-(q,r) elevation + a "deep" flag so the World Clock (System 1)
 * can apply the night pit/cave modifier server-authoritatively. This script keeps
 * the two in sync without duplicating the noise logic: it imports the generator
 * directly (tsx resolves cross-package TS imports).
 *
 * Run (like seed.ts, with DATABASE_URL in env):
 *   DATABASE_URL=... npx tsx scripts/syncTerrain.ts
 *
 * Idempotent: recomputing the deterministic world and writing the same values
 * yields the same DB state. Safe to re-run.
 *
 * ------------------------------------------------------------------------------
 * biome (Phase B — Weather): each hex's biome band from the generator's getBiome
 *   is written into hexes.biome (uppercased to the Prisma Biome enum). This is the
 *   server-authoritative source for the weather modifier table (weatherTable). The
 *   generator's biome contract is fixed, so re-runs are idempotent.
 *
 * isDeep DEFINITION (the "deep" night real estate — 1.2x at night vs 0.9x surface):
 *   A hex is DEEP if ANY of:
 *     1. it is a PIT floor            (HexData.isPit === true), OR
 *     2. it OWNS a cave mouth         (appears as (q,r) of some CaveMouth — the
 *        tall cliff face the cave is carved into), OR
 *     3. it is ADJACENT to a cave mouth (it is the lower neighbour a CaveMouth
 *        opens toward: (q + dir.q, r + dir.r) for that mouth's direction).
 *   This matches the design intent: "pits/caves we built become the smart night
 *   real estate" — both the cliff hex bearing the mouth and the hollow it opens
 *   into count as deep.
 * ------------------------------------------------------------------------------
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from the project root (three levels up from packages/server/scripts),
// matching seed.ts so DATABASE_URL resolves the same way.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { PrismaClient, Biome as PrismaBiome } from '@prisma/client';
// Cross-package import of the CLIENT terrain generator (tsx handles the TS).
import {
  generateWorld,
  type HexData,
  type CaveMouth,
} from '../../client/src/terrain/terrainGenerator.js';
import type { Biome as ClientBiome } from '../../client/src/terrain/biomes.js';

const prisma = new PrismaClient();

/**
 * Map the client generator's lowercase Biome string to the Prisma Biome enum.
 * The set of biomes is fixed by getBiome (grassland/marsh/plains/forest/rocky/
 * alpine), so this mapping is total and stable.
 */
const BIOME_TO_PRISMA: Record<ClientBiome, PrismaBiome> = {
  grassland: 'GRASSLAND',
  marsh: 'MARSH',
  plains: 'PLAINS',
  forest: 'FOREST',
  rocky: 'ROCKY',
  alpine: 'ALPINE',
};

// World radius — must match the seeded hex region (seed.ts / client HexWorld use 20).
const WORLD_RADIUS = 20;

/**
 * AXIAL_DIRECTIONS from the client hex math, inlined to avoid a second
 * cross-package import. Order MUST match terrainGenerator's `dirs` array
 * (E, NE, NW, W, SW, SE) so a CaveMouth.dir resolves to the correct neighbour.
 */
const AXIAL_DIRECTIONS: ReadonlyArray<{ q: number; r: number }> = [
  { q: 1, r: 0 }, // E
  { q: 1, r: -1 }, // NE
  { q: 0, r: -1 }, // NW
  { q: -1, r: 0 }, // W
  { q: -1, r: 1 }, // SW
  { q: 0, r: 1 }, // SE
];

const key = (q: number, r: number): string => `${q},${r}`;

/**
 * Build the set of "deep" hex keys from the generator outputs.
 * (Exported-in-spirit pure helper — kept local; the write step consumes it.)
 */
function computeDeepKeys(hexes: HexData[], caves: CaveMouth[]): Set<string> {
  const deep = new Set<string>();

  // 1. Pit floors.
  for (const h of hexes) {
    if (h.isPit) deep.add(key(h.q, h.r));
  }

  // 2 + 3. Cave-owning hexes and the lower neighbour each mouth opens toward.
  for (const cave of caves) {
    deep.add(key(cave.q, cave.r)); // owns a cave mouth on its cliff face
    const dir = AXIAL_DIRECTIONS[cave.dir % 6];
    if (dir) deep.add(key(cave.q + dir.q, cave.r + dir.r)); // adjacent hollow
  }

  return deep;
}

async function main(): Promise<void> {
  console.log(`Syncing terrain (radius ${WORLD_RADIUS}) into hexes.elevation / is_deep...`);

  // Deterministic world from the client generator (default seed).
  const { hexes, caves } = generateWorld(WORLD_RADIUS);
  const deepKeys = computeDeepKeys(hexes, caves);

  console.log(
    `Generated ${hexes.length} hexes, ${caves.length} cave mouths, ` +
      `${deepKeys.size} deep hexes.`
  );

  // Fetch existing hex ids by (q,r) so we only update rows that exist. The
  // generator produces the full radius-20 disc; DB rows come from seed.ts.
  const existing = await prisma.hex.findMany({ select: { id: true, q: true, r: true } });
  const idByKey = new Map<string, number>();
  for (const row of existing) idByKey.set(key(row.q, row.r), row.id);

  if (existing.length === 0) {
    console.warn('No hex rows found — seed the database first (db:seed). Nothing to update.');
    return;
  }

  let updated = 0;
  let missing = 0;

  // Batch the per-hex updates in chunks inside transactions. Idempotent: writing
  // the same deterministic values on a re-run is a no-op in effect.
  const CHUNK = 200;
  const ops: Array<{ id: number; elevation: number; isDeep: boolean; biome: PrismaBiome }> = [];

  for (const h of hexes) {
    const id = idByKey.get(key(h.q, h.r));
    if (id === undefined) {
      missing++;
      continue;
    }
    ops.push({
      id,
      elevation: h.elevation,
      isDeep: deepKeys.has(key(h.q, h.r)),
      biome: BIOME_TO_PRISMA[h.biome],
    });
  }

  for (let i = 0; i < ops.length; i += CHUNK) {
    const slice = ops.slice(i, i + CHUNK);
    await prisma.$transaction(
      slice.map((op) =>
        prisma.hex.update({
          where: { id: op.id },
          data: { elevation: op.elevation, isDeep: op.isDeep, biome: op.biome },
        })
      )
    );
    updated += slice.length;
  }

  const deepUpdated = ops.filter((o) => o.isDeep).length;
  console.log(
    `Terrain sync complete: updated ${updated} hexes ` +
      `(${deepUpdated} marked deep), ${missing} generated hexes had no DB row.`
  );
}

main()
  .catch((e) => {
    console.error('Terrain sync failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
