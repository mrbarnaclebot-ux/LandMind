/**
 * Earnings routes
 * Handles user earnings queries and claim transactions
 */
import { Router, Response } from 'express';
import { PublicKey, Connection, Transaction, TransactionInstruction } from '@solana/web3.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { getEarningsForUser } from '../services/earningsService.js';
import {
  generateMerkleTree,
  generateProof,
  hashLeaf,
  proofToContractFormat,
  rootToHex,
  UserShare,
} from '../services/merkleService.js';

export const earningsRouter = Router();

// Constants
const LANDMIND_PROGRAM_ID = new PublicKey('D4JvrX3Rtp9RTGUbLqxGcwYqYBtz3T5qZ1Q4hABXosSQ');
const MIN_CLAIM_LAMPORTS = 25_000_000n; // 0.025 SOL minimum claim

/**
 * Helper to serialize BigInt values to strings for JSON response
 */
function serializeBigInts<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

/**
 * Get RPC connection
 */
function getConnection(): Connection {
  const rpcUrl = process.env.HELIUS_RPC_URL || process.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * GET /api/earnings - Get user's earnings data
 * Requires authentication
 *
 * Returns:
 * - weightedScore: User's total weighted resource score
 * - totalPoolScore: Total weighted score across all users
 * - userShare: User's calculated share of fee pool
 * - availableFeePool: Total unprocessed fee deposits
 * - claimableAmount: Amount user can claim (share - already claimed)
 * - totalClaimed: Amount user has already claimed
 */
earningsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const earnings = await getEarningsForUser(req.userId!);

    // Get user wallet for display
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { walletPubkey: true },
    });

    res.json(serializeBigInts({
      ...earnings,
      wallet: user?.walletPubkey,
      minClaimAmount: MIN_CLAIM_LAMPORTS.toString(),
      canClaim: earnings.claimableAmount >= MIN_CLAIM_LAMPORTS,
    }));
  } catch (error) {
    console.error('Failed to fetch earnings:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

/**
 * POST /api/earnings/claim - Build claim transaction with Merkle proof
 * Requires authentication
 *
 * Returns unsigned transaction for client to sign and send
 */
earningsRouter.post('/claim', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's claimable amount
    const earnings = await getEarningsForUser(req.userId!);

    if (earnings.claimableAmount < MIN_CLAIM_LAMPORTS) {
      return res.status(400).json({
        error: 'Insufficient claimable amount',
        message: `Minimum claim is ${Number(MIN_CLAIM_LAMPORTS) / 1e9} SOL`,
        claimable: earnings.claimableAmount.toString(),
        minimum: MIN_CLAIM_LAMPORTS.toString(),
      });
    }

    // Get all users' claimable amounts for Merkle tree
    const allSnapshots = await prisma.earningsSnapshot.findMany({
      include: { user: { select: { walletPubkey: true } } },
    });

    const shares: UserShare[] = [];
    for (const snapshot of allSnapshots) {
      // Calculate each user's claimable
      const userEarnings = await getEarningsForUser(snapshot.userId);
      if (userEarnings.claimableAmount > 0n) {
        shares.push({
          wallet: snapshot.user.walletPubkey,
          claimableAmount: userEarnings.claimableAmount,
        });
      }
    }

    if (shares.length === 0) {
      return res.status(400).json({ error: 'No claimable earnings in pool' });
    }

    // Generate Merkle tree and proof
    const treeResult = generateMerkleTree(shares);
    const proof = generateProof(user.walletPubkey, earnings.claimableAmount, treeResult);

    if (!proof) {
      return res.status(400).json({ error: 'Could not generate proof for this wallet' });
    }

    // Derive PDAs
    const [vaultStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_state')],
      LANDMIND_PROGRAM_ID
    );
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('treasury')],
      LANDMIND_PROGRAM_ID
    );
    const [claimStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('claim_state'), new PublicKey(user.walletPubkey).toBuffer()],
      LANDMIND_PROGRAM_ID
    );

    // Build the claim_earnings instruction
    // Instruction discriminator for claim_earnings (first 8 bytes of sha256("global:claim_earnings"))
    const discriminator = Buffer.from([143, 233, 171, 4, 181, 61, 111, 145]);

    // Amount as u64 little-endian
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(earnings.claimableAmount);

    // Proof: vec of [u8; 32]
    // Vec prefix is 4-byte length (little-endian)
    const proofLenBuffer = Buffer.alloc(4);
    proofLenBuffer.writeUInt32LE(proof.length);
    const proofElements = proof.map(p => Buffer.from(p));
    const proofData = Buffer.concat([proofLenBuffer, ...proofElements]);

    const instructionData = Buffer.concat([discriminator, amountBuffer, proofData]);

    const claimInstruction = new TransactionInstruction({
      programId: LANDMIND_PROGRAM_ID,
      keys: [
        { pubkey: new PublicKey(user.walletPubkey), isSigner: true, isWritable: true }, // claimer
        { pubkey: vaultStatePda, isSigner: false, isWritable: false }, // vault_state
        { pubkey: treasuryPda, isSigner: false, isWritable: true }, // treasury
        { pubkey: claimStatePda, isSigner: false, isWritable: true }, // claim_state
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false }, // system_program
      ],
      data: instructionData,
    });

    // Build transaction
    const connection = getConnection();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const transaction = new Transaction().add(claimInstruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(user.walletPubkey);

    // Serialize for client
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString('base64');

    res.json({
      transaction: serializedTx,
      amount: earnings.claimableAmount.toString(),
      merkleRoot: rootToHex(treeResult.root),
      proofLength: proof.length,
      blockhash,
      lastValidBlockHeight,
    });
  } catch (error) {
    console.error('Failed to build claim transaction:', error);
    res.status(500).json({ error: 'Failed to build claim transaction' });
  }
});

/**
 * POST /api/earnings/confirm - Record claim after on-chain confirmation
 * Requires authentication
 *
 * Called after client successfully sends claim transaction
 */
earningsRouter.post('/confirm', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { signature, amount } = req.body;

    if (!signature) {
      return res.status(400).json({ error: 'Transaction signature required' });
    }

    if (!amount) {
      return res.status(400).json({ error: 'Claim amount required' });
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

    // Parse amount as BigInt
    const claimedAmount = BigInt(amount);

    // Update earnings snapshot with claimed amount
    await prisma.earningsSnapshot.update({
      where: { userId: req.userId },
      data: {
        totalClaimed: {
          increment: claimedAmount,
        },
      },
    });

    // Record claim in database
    const claim = await prisma.claim.create({
      data: {
        userId: req.userId!,
        amount: claimedAmount,
        txSignature: signature,
      },
    });

    // Get user for socket event
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { walletPubkey: true },
    });

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io && user) {
      io.to(`user:${user.walletPubkey}`).emit('claim:success', {
        claimId: claim.id,
        amount: claimedAmount.toString(),
        txSignature: signature,
      });
    }

    res.json(serializeBigInts({
      success: true,
      claim: {
        id: claim.id,
        amount: claim.amount,
        txSignature: claim.txSignature,
        claimedAt: claim.claimedAt,
      },
    }));
  } catch (error) {
    console.error('Failed to confirm claim:', error);

    // Emit error event
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { walletPubkey: true },
    });

    const io = req.app.get('io');
    if (io && user) {
      io.to(`user:${user.walletPubkey}`).emit('claim:error', {
        error: 'Failed to confirm claim',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    res.status(500).json({ error: 'Failed to confirm claim' });
  }
});
