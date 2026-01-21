/**
 * Agent deployment and management routes
 */
import { Router, Request, Response } from 'express';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { prisma } from '../lib/prisma.js';
import { mintAgentNFT, getAgentMetadata } from '../services/agentMinting.js';
import { placeAgentOnHex, getUserAgentStats } from '../services/agentPlacement.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

export const agentRouter = Router();

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
const LANDMIND_PROGRAM_ID = new PublicKey('D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ');

// Get RPC connection
function getConnection(): Connection {
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
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

    if (agentCount >= 20) {
      return res.status(400).json({
        error: 'Agent limit reached',
        message: 'You already have 20 agents deployed',
      });
    }

    const connection = getConnection();
    const payerPubkey = new PublicKey(user.walletPubkey);

    // Derive treasury PDA
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury')],
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

    if (!signature) {
      return res.status(400).json({ error: 'Transaction signature required' });
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

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get next agent index
    const lastAgent = await prisma.agent.findFirst({
      orderBy: { agentIndex: 'desc' },
      where: { agentIndex: { not: null } },
    });
    const agentIndex = (lastAgent?.agentIndex || 0) + 1;

    // Create agent record first
    const agent = await prisma.agent.create({
      data: {
        ownerId: req.userId!,
        status: 'IDLE',
        deployTxSig: signature,
        agentIndex,
      },
    });

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
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${user.walletPubkey}`).emit('agent:placed', {
            agentId: agent.id,
            hexId: placement.hexId,
            hexQ: placement.q,
            hexR: placement.r,
          });
        }
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
        const io = req.app.get('io');
        if (io) {
          io.to(`user:${user.walletPubkey}`).emit('agent:placed', {
            agentId: agent.id,
            hexId: placement.hexId,
            hexQ: placement.q,
            hexR: placement.r,
          });
        }
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
