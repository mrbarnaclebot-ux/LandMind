/**
 * Agent deployment and management routes
 */
import { Router, Request, Response } from 'express';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { mintAgentNFT, getAgentMetadata } from '../services/agentMinting.js';
import { placeAgentOnHex, getUserAgentStats } from '../services/agentPlacement.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { LANDMIND_PROGRAM_ID } from '../lib/programId.js';
import { TREASURY_SEED } from '../lib/pdaSeeds.js';
import { getIO } from '../lib/socket.js';
import crypto from 'crypto';
import {
  isFakeSolMode,
  isFakeSignature,
  FAKE_SIG_PREFIX,
  FAKE_ASSET_PREFIX,
} from '../lib/testMode.js';
import { cacheAgent } from '../cache/agentCache.js';
import { getCurrentTick } from '../simulation/tickLoop.js';

export const agentRouter = Router();

// Max agents a single user may deploy.
const MAX_AGENTS_PER_USER = 20;

/**
 * Helper to serialize BigInt values to strings for JSON response
 */
function serializeBigInts<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

// Constants
const DEPLOY_COST_LAMPORTS = 100_000_000; // 0.1 SOL

// Get RPC connection
function getConnection(): Connection {
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/** Sentinel error thrown inside the create transaction when the cap is hit. */
class AgentCapError extends Error {
  constructor() {
    super('Agent cap reached');
    this.name = 'AgentCapError';
  }
}

/**
 * Verify a confirmed deploy transaction actually transferred DEPLOY_COST_LAMPORTS
 * from `payerWallet` to `treasuryAddress`.
 *
 * We inspect pre/postBalances against the account keys: the treasury must have
 * gained >= DEPLOY_COST_LAMPORTS and the payer must have decreased by at least
 * that amount (payer also pays network fees, so its decrease is >= cost).
 */
function verifyDeployPayment(
  tx: Awaited<ReturnType<Connection['getTransaction']>>,
  payerWallet: string,
  treasuryAddress: string
): boolean {
  if (!tx || !tx.meta) return false;

  // Resolve account keys (supports both legacy and v0 messages).
  const message = tx.transaction.message;
  const staticKeys = message.staticAccountKeys ?? [];
  const accountKeys = staticKeys.map((k) => k.toBase58());

  const payerIndex = accountKeys.indexOf(payerWallet);
  const treasuryIndex = accountKeys.indexOf(treasuryAddress);

  // Both accounts must be present in the static keys.
  if (payerIndex === -1 || treasuryIndex === -1) return false;

  const { preBalances, postBalances } = tx.meta;
  const treasuryDelta =
    (postBalances[treasuryIndex] ?? 0) - (preBalances[treasuryIndex] ?? 0);
  const payerDelta =
    (postBalances[payerIndex] ?? 0) - (preBalances[payerIndex] ?? 0);

  // Treasury must have received at least the deploy cost.
  if (treasuryDelta < DEPLOY_COST_LAMPORTS) return false;
  // Payer must have paid at least the deploy cost (their balance decreased).
  if (payerDelta > -DEPLOY_COST_LAMPORTS) return false;

  return true;
}

/**
 * Create a fake (test-mode) agent end-to-end: enforce the cap + uniqueness
 * inside a DB transaction, assign a fake assetId (no cNFT), place it on a hex,
 * register it in the Redis cache so the tick loop mines it, and emit agent:placed.
 *
 * Returns the assembled agent payload, or a sentinel object on cap/sig-reuse so
 * the caller can map to the right HTTP status. Mirrors the real /confirm flow
 * minus on-chain verification and minting.
 */
async function createFakeAgent(
  userId: string,
  walletPubkey: string,
  signature: string
): Promise<
  | { agent: Record<string, unknown> }
  | { capReached: true }
  | { sigReused: true }
> {
  let agent;
  try {
    agent = await prisma.$transaction(async (txClient) => {
      const count = await txClient.agent.count({ where: { ownerId: userId } });
      if (count >= MAX_AGENTS_PER_USER) {
        throw new AgentCapError();
      }

      const lastAgent = await txClient.agent.findFirst({
        orderBy: { agentIndex: 'desc' },
        where: { agentIndex: { not: null } },
      });
      const nextIndex = (lastAgent?.agentIndex || 0) + 1;

      return txClient.agent.create({
        data: {
          ownerId: userId,
          status: 'IDLE',
          deployTxSig: signature,
          agentIndex: nextIndex,
          // Fake asset id — clearly not a real cNFT asset id.
          mintAddress: `${FAKE_ASSET_PREFIX}${crypto.randomUUID()}`,
        },
      });
    });
  } catch (txErr) {
    if (txErr instanceof AgentCapError) {
      return { capReached: true };
    }
    if (
      txErr instanceof Prisma.PrismaClientKnownRequestError &&
      txErr.code === 'P2002'
    ) {
      return { sigReused: true };
    }
    throw txErr;
  }

  const agentIndex = agent.agentIndex!;

  // Place the agent on a hex (random placement, MINING status + mining state).
  const placement = await placeAgentOnHex(agent.id);

  // Register in the Redis cache exactly like real/seeded agents so the tick loop
  // picks it up and mining:update / earnings:update events flow for it.
  if (placement) {
    await cacheAgent({
      agentId: agent.id,
      ownerId: userId,
      ownerWallet: walletPubkey,
      hexId: placement.hexId,
      hexQ: placement.q,
      hexR: placement.r,
      gold: '0',
      silver: '0',
      copper: '0',
      iron: '0',
      status: 'MINING',
      lastTick: getCurrentTick(),
    });

    getIO().to(`user:${walletPubkey}`).emit('agent:placed', {
      agentId: agent.id,
      hexId: placement.hexId,
      hexQ: placement.q,
      hexR: placement.r,
    });
  }

  return {
    agent: {
      id: agent.id,
      agentIndex,
      mintAddress: agent.mintAddress,
      hexId: placement?.hexId ?? null,
      hexQ: placement?.q ?? null,
      hexR: placement?.r ?? null,
    },
  };
}

/**
 * GET /api/agents - Get user's agents
 * Requires authentication
 */
agentRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      where: { ownerId: req.userId },
      include: { miningState: true, hex: true },
      orderBy: { deployedAt: 'desc' },
    });

    // Serialize BigInt values to strings for JSON response
    res.json({ agents: serializeBigInts(agents) });
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/agents/stats - Get user's agent statistics
 */
agentRouter.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getUserAgentStats(req.userId!);
    res.json(stats);
  } catch (error) {
    console.error('Failed to get agent stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /api/agents/:id/metadata - Get agent NFT metadata
 * Public endpoint for Metaplex URI
 */
agentRouter.get('/:id/metadata', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const metadata = getAgentMetadata(agent.id, agent.agentIndex || 0);
    res.json(metadata);
  } catch (error) {
    console.error('Failed to get metadata:', error);
    res.status(500).json({ error: 'Failed to get metadata' });
  }
});

/**
 * POST /api/agents/deploy - Create deployment transaction
 * Returns unsigned transaction for client to sign and send
 * Requires authentication
 */
agentRouter.post('/deploy', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get user's wallet
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check agent count (soft cap warning)
    const agentCount = await prisma.agent.count({
      where: { ownerId: req.userId },
    });

    if (agentCount >= MAX_AGENTS_PER_USER) {
      return res.status(400).json({
        error: 'Agent limit reached',
        message: `You already have ${MAX_AGENTS_PER_USER} agents deployed`,
      });
    }

    // FAKE-SOL TEST MODE: skip building a real on-chain transaction entirely and
    // hand back a fake signature. /confirm recognizes the FAKE- prefix and skips
    // on-chain verification. Gated behind the env flag; unreachable in prod.
    if (isFakeSolMode()) {
      const deployTxSig = `${FAKE_SIG_PREFIX}${crypto.randomUUID()}`;
      return res.json({
        fake: true,
        deployTxSig,
        cost: 0,
        warning:
          agentCount >= 10
            ? `You have ${agentCount} agents. Soft cap is 20.`
            : undefined,
      });
    }

    const connection = getConnection();
    const payerPubkey = new PublicKey(user.walletPubkey);

    // Derive treasury PDA
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(TREASURY_SEED)],
      LANDMIND_PROGRAM_ID
    );

    // Create transaction with deploy_agent instruction
    // For now, use simple SOL transfer since Anchor client needs program types
    // TODO: Replace with proper Anchor instruction when IDL is available
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payerPubkey,
        toPubkey: treasuryPda,
        lamports: DEPLOY_COST_LAMPORTS,
      })
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payerPubkey;

    // Serialize for client
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString('base64');

    res.json({
      transaction: serializedTx,
      treasuryAddress: treasuryPda.toBase58(),
      cost: DEPLOY_COST_LAMPORTS,
      blockhash,
      lastValidBlockHeight,
      warning: agentCount >= 10 ? `You have ${agentCount} agents. Soft cap is 20.` : undefined,
    });
  } catch (error) {
    console.error('Failed to create deploy transaction:', error);
    res.status(500).json({ error: 'Failed to create deployment transaction' });
  }
});

/**
 * POST /api/agents/confirm - Confirm deployment and mint cNFT
 * Called after client successfully sends deploy transaction
 * Requires authentication
 */
agentRouter.post('/confirm', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { signature } = req.body;

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Transaction signature required' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Explicit pre-check: reject a deployTxSig that was already used.
    // (Backed by the DB unique constraint below to close the race window.)
    const existingWithSig = await prisma.agent.findUnique({
      where: { deployTxSig: signature },
    });
    if (existingWithSig) {
      return res.status(409).json({
        error: 'Transaction already used',
        message: 'This deployment transaction has already been redeemed for an agent.',
      });
    }

    // FAKE-SOL TEST MODE: when the flag is on AND this is a fake signature, skip
    // ALL on-chain verification and cNFT minting. We deliberately KEEP: auth
    // (requireAuth), deployTxSig uniqueness (pre-check above + DB unique
    // constraint inside the tx), the 20-agent cap enforced INSIDE the tx, hex
    // placement, DB create, the agent:placed socket emit, and Redis cache
    // registration so the tick loop mines the fake agent like a real one.
    if (isFakeSolMode() && isFakeSignature(signature)) {
      const result = await createFakeAgent(req.userId!, user.walletPubkey, signature);
      if ('capReached' in result) {
        return res.status(400).json({
          error: 'Agent limit reached',
          message: `You already have ${MAX_AGENTS_PER_USER} agents deployed`,
        });
      }
      if ('sigReused' in result) {
        return res.status(409).json({
          error: 'Transaction already used',
          message: 'This deployment transaction has already been redeemed for an agent.',
        });
      }
      return res.json({ success: true, fake: true, agent: result.agent });
    }

    const connection = getConnection();

    // Verify transaction on-chain
    const tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return res.status(400).json({ error: 'Transaction not found' });
    }

    if (tx.meta?.err) {
      return res.status(400).json({ error: 'Transaction failed', details: tx.meta.err });
    }

    // Derive the treasury PDA (deploy fee destination).
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(TREASURY_SEED)],
      LANDMIND_PROGRAM_ID
    );

    // Verify the tx actually moved DEPLOY_COST_LAMPORTS from THIS user's wallet
    // to the treasury PDA. We check the balance deltas against account keys.
    const paid = verifyDeployPayment(tx, user.walletPubkey, treasuryPda.toBase58());
    if (!paid) {
      return res.status(400).json({
        error: 'Invalid deployment payment',
        message:
          'Transaction did not transfer the required deployment fee from your wallet to the treasury.',
      });
    }

    // Create the agent atomically with the 20-agent cap enforced INSIDE the
    // same transaction (closes the count-then-create race, M-5). The
    // deployTxSig unique constraint also protects against sig reuse races.
    let agent;
    try {
      agent = await prisma.$transaction(async (txClient) => {
        const count = await txClient.agent.count({
          where: { ownerId: req.userId! },
        });
        if (count >= MAX_AGENTS_PER_USER) {
          throw new AgentCapError();
        }

        // Compute next global agent index inside the transaction.
        const lastAgent = await txClient.agent.findFirst({
          orderBy: { agentIndex: 'desc' },
          where: { agentIndex: { not: null } },
        });
        const nextIndex = (lastAgent?.agentIndex || 0) + 1;

        return txClient.agent.create({
          data: {
            ownerId: req.userId!,
            status: 'IDLE',
            deployTxSig: signature,
            agentIndex: nextIndex,
          },
        });
      });
    } catch (txErr) {
      if (txErr instanceof AgentCapError) {
        return res.status(400).json({
          error: 'Agent limit reached',
          message: `You already have ${MAX_AGENTS_PER_USER} agents deployed`,
        });
      }
      // Unique constraint violation on deployTxSig => concurrent reuse.
      if (
        txErr instanceof Prisma.PrismaClientKnownRequestError &&
        txErr.code === 'P2002'
      ) {
        return res.status(409).json({
          error: 'Transaction already used',
          message: 'This deployment transaction has already been redeemed for an agent.',
        });
      }
      throw txErr;
    }

    const agentIndex = agent.agentIndex!;

    // Mint cNFT (async - could fail but agent is already created)
    try {
      const mintResult = await mintAgentNFT(
        user.walletPubkey,
        agent.id,
        agentIndex
      );

      // Update agent with mint info
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          mintAddress: mintResult.assetId,
          mintTxSig: mintResult.signature,
        },
      });

      // Place agent on a hex
      const placement = await placeAgentOnHex(agent.id);

      if (placement) {
        // Emit socket event for real-time update
        getIO().to(`user:${user.walletPubkey}`).emit('agent:placed', {
          agentId: agent.id,
          hexId: placement.hexId,
          hexQ: placement.q,
          hexR: placement.r,
        });
      }

      res.json({
        success: true,
        agent: {
          id: agent.id,
          agentIndex,
          mintAddress: mintResult.assetId,
          hexId: placement?.hexId ?? null,
          hexQ: placement?.q ?? null,
          hexR: placement?.r ?? null,
        },
      });
    } catch (mintError) {
      console.error('Minting failed but agent created:', mintError);

      // Still try to place the agent even if minting failed
      const placement = await placeAgentOnHex(agent.id);

      if (placement) {
        getIO().to(`user:${user.walletPubkey}`).emit('agent:placed', {
          agentId: agent.id,
          hexId: placement.hexId,
          hexQ: placement.q,
          hexR: placement.r,
        });
      }

      // Agent exists but minting failed - can retry later
      res.json({
        success: true,
        agent: {
          id: agent.id,
          agentIndex,
          mintAddress: null,
          mintPending: true,
          hexId: placement?.hexId ?? null,
          hexQ: placement?.q ?? null,
          hexR: placement?.r ?? null,
        },
        warning: 'Agent created but NFT minting pending',
      });
    }
  } catch (error) {
    console.error('Failed to confirm deployment:', error);
    res.status(500).json({ error: 'Failed to confirm deployment' });
  }
});
