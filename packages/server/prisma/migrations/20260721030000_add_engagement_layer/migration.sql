-- Phase D (Engagement) — daily contracts, prospecting/surveys, seasons.
--
-- 1. users.contract_streak — resume-not-reset daily-contract streak. NEVER resets
--    on a missed day (design System 4 — Egg Inc calendar model). Increments by 1
--    each UTC day the user completes their contract.
--
-- 2. users.season_bonus_pct — permanent additive per-season yield bonus (+0.02 per
--    closed season the user participated in). Joins the tick-loop yield product as
--    (1 + season_bonus_pct). Never a hard wipe (anti-pattern rule 7).
--
-- 3. contracts — one row per (user, UTC day). Deterministic per (userId, dateUTC),
--    generated lazily on GET /api/contracts. Progress accrues from the tick loop;
--    completion sets completed_at and bumps the owner's contract_streak.
--
-- 4. surveys — durable per-user prospecting unlocks. One row per (user, q, r). The
--    snapshot returned to the client always reads CURRENT hex data (join at read).
--
-- 5. seasons + season_results — soft-prestige snapshot. A season is closed manually
--    (scripts/closeSeason.ts): the leaderboard ZSET is snapshotted into
--    season_results rows, the ZSET reset, and every participant's season_bonus_pct
--    incremented by 0.02.
--
-- Create-only migration (matches the existing 0_init / hazards style): run with
-- `prisma migrate deploy` (or dev) against the target database.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "contract_streak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "season_bonus_pct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date_utc" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "target" BIGINT NOT NULL,
    "progress" BIGINT NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "surveyed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_pool" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_results" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" BIGINT NOT NULL,

    CONSTRAINT "season_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_user_id_idx" ON "contracts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_user_id_date_utc_key" ON "contracts"("user_id", "date_utc");

-- CreateIndex
CREATE INDEX "surveys_user_id_idx" ON "surveys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "surveys_user_id_q_r_key" ON "surveys"("user_id", "q", "r");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_number_key" ON "seasons"("number");

-- CreateIndex
CREATE INDEX "season_results_season_id_idx" ON "season_results"("season_id");

-- CreateIndex
CREATE UNIQUE INDEX "season_results_season_id_user_id_key" ON "season_results"("season_id", "user_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
