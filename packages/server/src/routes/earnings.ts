/**
 * Earnings routes
 * Handles user earnings queries and claim transactions
 */
import { Router, Response } from 'express';
import {
  PublicKey,
  Connection,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { getEarningsForUser } from '../services/earningsService.js';
import { isClaimsPaused } from '../services/economyService.js';
import {
  getOrBuildMerkleTree,
  generateProof,
  rootToHex,
  UserShare,
} from '../services/merkleService.js';
import { LANDMIND_PROGRAM_ID } from '../lib/programId.js';
import { TREASURY_SEED, VAULT_STATE_SEED, CLAIM_SEED } from '../lib/pdaSeeds.js';
import { getIO } from '../lib/socket.js';

export const earningsRouter = Router();

// Constants
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
    // Check if claims are paused (emergency pause)
    if (await isClaimsPaused()) {
      return res.status(503).json({
        error: 'Claims are currently paused',
        message: 'The platform has temporarily paused claims. Please try again later.',
      });
    }

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

    // Build the set of leaves for the Merkle tree. Per the pinned contract, a
    // leaf commits to the user's CUMULATIVE lifetime allowance (total_allowance),
    // NOT the per-claim amount. On-chain payout = total_allowance - claimed_total.
    const allSnapshots = await prisma.earningsSnapshot.findMany({
      include: { user: { select: { walletPubkey: true } } },
    });

    const shares: UserShare[] = [];
    for (const snapshot of allSnapshots) {
      const userEarnings = await getEarningsForUser(snapshot.userId);
      // Include everyone with a non-zero cumulative allowance so the tree is
      // stable regardless of who has already claimed.
      if (userEarnings.cumulativeAllowance > 0n) {
        shares.push({
          wallet: snapshot.user.walletPubkey,
          totalAllowance: userEarnings.cumulativeAllowance,
        });
      }
    }

    if (shares.length === 0) {
      return res.status(400).json({ error: 'No claimable earnings in pool' });
    }

    // Generate (or reuse cached) Merkle tree and this wallet's proof.
    const treeResult = getOrBuildMerkleTree(shares);
    const proof = generateProof(user.walletPubkey, treeResult);

    if (!proof) {
      return res.status(400).json({ error: 'Could not generate proof for this wallet' });
    }

    // total_allowance committed for this wallet (cumulative lifetime allowance).
    const totalAllowance = earnings.cumulativeAllowance;

    // Derive PDAs (pinned seeds).
    const [vaultStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_STATE_SEED)],
      LANDMIND_PROGRAM_ID
    );
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(TREASURY_SEED)],
      LANDMIND_PROGRAM_ID
    );
    const claimerPubkey = new PublicKey(user.walletPubkey);
    const [claimStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from(CLAIM_SEED), claimerPubkey.toBuffer()],
      LANDMIND_PROGRAM_ID
    );

    // Build the claim_earnings instruction.
    // args = (total_allowance: u64, proof: Vec<[u8; 32]>)
    const discriminator = Buffer.from([143, 233, 171, 4, 181, 61, 111, 145]);

    // total_allowance as u64 little-endian
    const allowanceBuffer = Buffer.alloc(8);
    allowanceBuffer.writeBigUInt64LE(totalAllowance);

    // Proof: Vec<[u8; 32]> with a 4-byte little-endian length prefix.
    const proofLenBuffer = Buffer.alloc(4);
    proofLenBuffer.writeUInt32LE(proof.length);
    const proofElements = proof.map((p) => Buffer.from(p));
    const proofData = Buffer.concat([proofLenBuffer, ...proofElements]);

    const instructionData = Buffer.concat([discriminator, allowanceBuffer, proofData]);

    // Accounts in the exact pinned order with correct writability:
    //   vault_state (w), treasury PDA (w), claim_state PDA (w, init_if_needed),
    //   claimer (signer, w), system_program.
    const claimInstruction = new TransactionInstruction({
      programId: LANDMIND_PROGRAM_ID,
      keys: [
        { pubkey: vaultStatePda, isSigner: false, isWritable: true }, // vault_state (writable)
        { pubkey: treasuryPda, isSigner: false, isWritable: true }, // treasury PDA (writable)
        { pubkey: claimStatePda, isSigner: false, isWritable: true }, // claim_state PDA (writable, init_if_needed)
        { pubkey: claimerPubkey, isSigner: true, isWritable: true }, // claimer (signer, writable)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      data: instructionData,
    });

    // Build transaction
    const connection = getConnection();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const transaction = new Transaction().add(claimInstruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = claimerPubkey;

    // Serialize for client
    const serializedTx = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    }).toString('base64');

    res.json({
      transaction: serializedTx,
      // Amount the user can claim now (informational); on-chain payout is derived
      // from total_allowance - claimed_total.
      amount: earnings.claimableAmount.toString(),
      totalAllowance: totalAllowance.toString(),
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
    const { signature } = req.body;

    // NOTE: client-supplied `amount` is deliberately IGNORED. The claimed value
    // is derived from the on-chain transaction below.
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Transaction signature required' });
    }

    // Pre-check: reject an already-recorded signature (backed by the unique
    // Claim.txSignature constraint to close the race).
    const existingClaim = await prisma.claim.findUnique({
      where: { txSignature: signature },
    });
    if (existingClaim) {
      return res.status(409).json({
        error: 'Claim already recorded',
        message: 'This transaction has already been recorded as a claim.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { walletPubkey: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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

    // Require that the tx actually invoked OUR program.
    if (!txInvokesProgram(tx, LANDMIND_PROGRAM_ID.toBase58())) {
      return res.status(400).json({
        error: 'Invalid claim transaction',
        message: 'Transaction did not invoke the LandMind program.',
      });
    }

    // Derive the actual claimed lamports from the claimer's balance change.
    // Payout increases the claimer's balance; they also pay the network fee, so
    // claimed = balanceDelta + fee (fee is only charged to the fee payer, which
    // is the claimer here). We reconstruct the gross payout as:
    //   claimed = (post - pre) + fee
    const derivedClaimed = deriveClaimedLamports(tx, user.walletPubkey);
    if (derivedClaimed <= 0n) {
      return res.status(400).json({
        error: 'Invalid claim transaction',
        message: 'Could not derive a positive claimed amount from the transaction.',
      });
    }

    // Record the claim and bump totalClaimed by the DERIVED amount, atomically.
    let claim;
    try {
      claim = await prisma.$transaction(async (txClient) => {
        const created = await txClient.claim.create({
          data: {
            userId: req.userId!,
            amount: derivedClaimed,
            txSignature: signature,
          },
        });

        await txClient.earningsSnapshot.update({
          where: { userId: req.userId! },
          data: {
            totalClaimed: { increment: derivedClaimed },
            lastClaimAt: new Date(),
          },
        });

        return created;
      });
    } catch (txErr) {
      // Concurrent duplicate signature => unique violation.
      const code = (txErr as { code?: string }).code;
      if (code === 'P2002') {
        return res.status(409).json({
          error: 'Claim already recorded',
          message: 'This transaction has already been recorded as a claim.',
        });
      }
      throw txErr;
    }

    // Emit socket event for real-time update
    getIO().to(`user:${user.walletPubkey}`).emit('claim:success', {
      claimId: claim.id,
      amount: derivedClaimed.toString(),
      txSignature: signature,
    });

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
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { walletPubkey: true },
      });
      if (user) {
        getIO().to(`user:${user.walletPubkey}`).emit('claim:error', {
          error: 'Failed to confirm claim',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } catch {
      // ignore socket emit failures on the error path
    }

    res.status(500).json({ error: 'Failed to confirm claim' });
  }
});

/**
 * Whether a fetched transaction invoked the given program id (checks the static
 * account keys, which include all invoked program ids for the message).
 */
function txInvokesProgram(
  tx: NonNullable<Awaited<ReturnType<Connection['getTransaction']>>>,
  programId: string
): boolean {
  const staticKeys = tx.transaction.message.staticAccountKeys ?? [];
  return staticKeys.some((k) => k.toBase58() === programId);
}

/**
 * Derive the lamports paid out to `claimerWallet` in a confirmed claim tx.
 *
 * The claimer is the fee payer, so their raw balance delta is
 * (payout - networkFee). We add the fee back to recover the gross payout.
 */
function deriveClaimedLamports(
  tx: NonNullable<Awaited<ReturnType<Connection['getTransaction']>>>,
  claimerWallet: string
): bigint {
  if (!tx.meta) return 0n;

  const staticKeys = tx.transaction.message.staticAccountKeys ?? [];
  const idx = staticKeys.findIndex((k) => k.toBase58() === claimerWallet);
  if (idx === -1) return 0n;

  const pre = BigInt(tx.meta.preBalances[idx] ?? 0);
  const post = BigInt(tx.meta.postBalances[idx] ?? 0);
  const fee = BigInt(tx.meta.fee ?? 0);

  // Gross payout = net balance increase + fee the claimer paid.
  const claimed = post - pre + fee;
  return claimed > 0n ? claimed : 0n;
}
