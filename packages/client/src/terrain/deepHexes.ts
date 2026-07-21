/**
 * deepHexes — a lightweight, deterministic "is this hex DEEP?" lookup for the
 * deploy/relocation affordance (System 3, Phase C).
 *
 * "Deep" = a pit floor (`isPit`) OR a cave-adjacent hex (the tall side of a cave
 * face). These are exactly the hexes that carry the standing deep-deploy yield
 * bonus and the cave-in risk. The terrain generator already computes both signals
 * deterministically from (q,r) + a fixed seed, so we can rebuild the set ONCE from
 * `generateWorld` output and cache it — no per-frame terrain lookups, no refactor
 * of the generator.
 *
 * The world is deterministic per (gridRadius, seed); the client uses the same
 * radius the scene renders with (VITE_HEX_GRID_RADIUS), so the deep set matches
 * what's on screen. The set is built lazily on first query and memoized per
 * radius, so it costs nothing until the tooltip actually asks.
 */
import { generateWorld, type TerrainSeed } from './terrainGenerator';

/** Same default the scene uses (ThreeScene GRID_RADIUS). */
const DEFAULT_GRID_RADIUS = parseInt(
  (import.meta as any).env?.VITE_HEX_GRID_RADIUS || '20',
  10,
);

const cache = new Map<string, Set<string>>();

function keyOf(q: number, r: number): string {
  return `${q},${r}`;
}

/**
 * Build (and cache) the set of DEEP hex keys for a given radius/seed. Runs the
 * deterministic world gen once. Pit floors come straight off `isPit`; cave-
 * adjacent hexes are the owning (tall) side of each cave mouth.
 */
function buildDeepSet(gridRadius: number, seed?: TerrainSeed): Set<string> {
  const cacheKey = `${gridRadius}:${seed?.terraform ?? 'default'}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const set = new Set<string>();
  try {
    const { hexes, caves } = generateWorld(gridRadius, seed);
    for (const h of hexes) {
      if (h.isPit) set.add(keyOf(h.q, h.r));
    }
    // Cave mouths sit on the TALL hex's face → that hex is cave-adjacent (deep).
    for (const cave of caves) {
      set.add(keyOf(cave.q, cave.r));
    }
  } catch {
    // Fail soft: an empty set just means the affordance never shows.
  }

  cache.set(cacheKey, set);
  return set;
}

/**
 * Whether (q,r) is a DEEP hex (pit floor or cave-adjacent). Uses the scene's
 * default grid radius unless overridden. Cheap after the first call (cached).
 */
export function isDeepHex(q: number, r: number, gridRadius = DEFAULT_GRID_RADIUS): boolean {
  return buildDeepSet(gridRadius).has(keyOf(q, r));
}
