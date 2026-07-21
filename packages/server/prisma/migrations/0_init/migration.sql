-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('IDLE', 'MINING', 'RELOCATING');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('GOLD', 'SILVER', 'COPPER', 'IRON', 'EMPTY');

-- CreateEnum
CREATE TYPE "FeeSource" AS ENUM ('DEPLOYMENT', 'PUMPFUN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_pubkey" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "hex_id" INTEGER,
    "status" "AgentStatus" NOT NULL DEFAULT 'IDLE',
    "deployed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mint_address" TEXT,
    "deploy_tx_sig" TEXT,
    "mint_tx_sig" TEXT,
    "agent_index" INTEGER,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hexes" (
    "id" SERIAL NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "resource_amount" BIGINT NOT NULL DEFAULT 1000000,

    CONSTRAINT "hexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mining_states" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "gold" BIGINT NOT NULL DEFAULT 0,
    "silver" BIGINT NOT NULL DEFAULT 0,
    "copper" BIGINT NOT NULL DEFAULT 0,
    "iron" BIGINT NOT NULL DEFAULT 0,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mining_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_deposits" (
    "id" TEXT NOT NULL,
    "tx_signature" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "source" "FeeSource" NOT NULL,
    "deposited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fee_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "tx_signature" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earnings_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weighted_score" BIGINT NOT NULL,
    "total_claimed" BIGINT NOT NULL DEFAULT 0,
    "last_claim_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "earnings_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economy_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "min_claim_amount" BIGINT NOT NULL DEFAULT 25000000,
    "gold_weight" INTEGER NOT NULL DEFAULT 4000,
    "silver_weight" INTEGER NOT NULL DEFAULT 2000,
    "copper_weight" INTEGER NOT NULL DEFAULT 1500,
    "iron_weight" INTEGER NOT NULL DEFAULT 1000,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "paused_at" TIMESTAMP(3),
    "paused_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "economy_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_pubkey_key" ON "users"("wallet_pubkey");

-- CreateIndex
CREATE UNIQUE INDEX "agents_mint_address_key" ON "agents"("mint_address");

-- CreateIndex
CREATE UNIQUE INDEX "agents_deploy_tx_sig_key" ON "agents"("deploy_tx_sig");

-- CreateIndex
CREATE INDEX "hexes_q_r_idx" ON "hexes"("q", "r");

-- CreateIndex
CREATE UNIQUE INDEX "hexes_q_r_key" ON "hexes"("q", "r");

-- CreateIndex
CREATE UNIQUE INDEX "mining_states_agent_id_key" ON "mining_states"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_deposits_tx_signature_key" ON "fee_deposits"("tx_signature");

-- CreateIndex
CREATE UNIQUE INDEX "claims_tx_signature_key" ON "claims"("tx_signature");

-- CreateIndex
CREATE UNIQUE INDEX "earnings_snapshots_user_id_key" ON "earnings_snapshots"("user_id");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_hex_id_fkey" FOREIGN KEY ("hex_id") REFERENCES "hexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mining_states" ADD CONSTRAINT "mining_states_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earnings_snapshots" ADD CONSTRAINT "earnings_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

