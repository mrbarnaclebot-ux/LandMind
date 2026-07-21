-- Phase C (Hazards) — cave-ins, equipment wear, offline-grace tracking.
--
-- 1. AgentStatus gains TRAPPED — an agent caught in a cave-in stops mining until
--    the owner taps Rescue (SOL fee → treasury) or the 4-hour self-dig timer
--    passes. Never confiscates already-mined resources (design System 3).
--
-- 2. agents.wear — equipment wear ∈ [0,1]. Accrues ONLY while actively mining
--    (Minecraft model, never idle-time decay). Reaches 1.0 after ~3 days of
--    active mining; efficiency = 1 - 0.3*wear (100% → 70% floor). Repair
--    (SOL fee → treasury) resets it to 0.
--
-- 3. agents.trapped_at — when the cave-in fired (NULL = not trapped).
--    agents.self_dig_at — when the agent auto-frees itself (NULL = not trapped).
--
-- 4. users.last_active_at — throttled (≤1/min) last-seen timestamp. Cave-ins
--    only fire on agents whose owner was active within the last 60 min
--    (offline-grace rule: hazards pause for absent players' agents).
--
-- Create-only migration (matches the existing 0_init / elevation+is_deep style):
-- run with `prisma migrate deploy` (or dev) against the target database.
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block on
-- PostgreSQL < 12 and, in the same transaction, the new value cannot yet be
-- used. Prisma executes each statement in this file sequentially; the enum
-- value is only referenced at runtime (never in the DDL below), so this is safe.

-- AlterEnum
ALTER TYPE "AgentStatus" ADD VALUE 'TRAPPED';

-- AlterTable
ALTER TABLE "agents" ADD COLUMN "wear" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "agents" ADD COLUMN "trapped_at" TIMESTAMP(3);
ALTER TABLE "agents" ADD COLUMN "self_dig_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "last_active_at" TIMESTAMP(3);
