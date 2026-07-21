-- Phase A (World Clock) — add terrain metadata to hexes.
-- `elevation`: visual terrain tier 0..6 (mirrors the client terrain generator).
-- `is_deep`  : pit floor OR cave-mouth-adjacent hex — the "deep" night real estate
--              that gets the 1.2x night modifier (surface gets 0.9x).
-- Populated out-of-band by scripts/syncTerrain.ts; defaults keep existing rows valid.

-- AlterTable
ALTER TABLE "hexes" ADD COLUMN "elevation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "hexes" ADD COLUMN "is_deep" BOOLEAN NOT NULL DEFAULT false;
