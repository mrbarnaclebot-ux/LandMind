-- Phase B (Weather fronts + relocation-as-action).
--
-- 1. hexes.biome — the biome band from the client terrain generator's getBiome
--    (single source of truth). Drives the per-front weather yield modifier
--    (weatherTable in src/simulation/weatherService.ts). Populated out-of-band
--    by scripts/syncTerrain.ts from HexData.biome. GRASSLAND default keeps
--    existing rows valid until the sync runs.
--
-- 2. agents.last_relocated_at — timestamp of the last manual relocation, used
--    to enforce the 10-minute per-agent relocation cooldown. NULL = never
--    relocated (no cooldown in effect).
--
-- Create-only migration (matches the existing 0_init / elevation+is_deep style):
-- run with `prisma migrate deploy` (or dev) against the target database.

-- CreateEnum
CREATE TYPE "Biome" AS ENUM ('GRASSLAND', 'MARSH', 'PLAINS', 'FOREST', 'ROCKY', 'ALPINE');

-- AlterTable
ALTER TABLE "hexes" ADD COLUMN "biome" "Biome" NOT NULL DEFAULT 'GRASSLAND';

-- AlterTable
ALTER TABLE "agents" ADD COLUMN "last_relocated_at" TIMESTAMP(3);
