/**
 * Fee monitoring service
 *
 * Tracks incoming fee deposits from:
 * - Treasury PDA (agent deployment fees)
 * - PumpFun fee wallet (trading fees)
 *
 * Records deposits to FeeDeposit table for distribution calculation
 */
import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { prisma } from '../lib/prisma.js';
import { LANDMIND_PROGRAM_ID } from '../lib/programId.js';
import { TREASURY_SEED } from '../lib/pdaSeeds.js';

// Check interval: 60 seconds
const CHECK_INTERVAL = 60_000;

// Track last processed slot to avoid reprocessing
let lastProcessedSlot = 0;

// Monitor timer reference
let monitorTimer: ReturnType<typeof setTimeout> | null = null;

// Treasury PDA: seeds = ["treasury"]
const [TREASURY_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from(TREASURY_SEED)],
  LANDMIND_PROGRAM_ID
);

// PumpFun fee wallet (optional - from environment)
const PUMPFUN_FEE_WALLET = process.env.PUMPFUN_FEE_WALLET
  ? new PublicKey(process.env.PUMPFUN_FEE_WALLET)
  : null;

/**
 * Check for new fee deposits on the PumpFun wallet
 *
 * @param connection - Solana RPC connection
 * @returns Number of new deposits recorded
 */
export async function checkForFeeDeposits(connection: Connection): Promise<number> {
  if (!PUMPFUN_FEE_WALLET) {
    return 0;
  }

  try {
    // Get recent signatures for the PumpFun wallet
    const signatures = await connection.getSignaturesForAddress(
      PUMPFUN_FEE_WALLET,
      { limit: 50 }
    );

    if (signatures.length === 0) {
      return 0;
    }

    // Filter to signatures we haven't processed
    const existingTxs = await prisma.feeDeposit.findMany({
      where: {
        txSignature: {
          in: signatures.map(s => s.signature),
        },
      },
      select: { txSignature: true },
    });

    const existingSet = new Set(existingTxs.map(t => t.txSignature));
    const newSignatures = signatures.filter(s => !existingSet.has(s.signature));

    if (newSignatures.length === 0) {
      return 0;
    }

    let depositsRecorded = 0;

    // Process each new transaction
    for (const sig of newSignatures) {
      try {
        const tx = await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx) continue;

        // Find SOL transfers to the PumpFun wallet
        const depositAmount = extractDepositAmount(tx, PUMPFUN_FEE_WALLET);

        if (depositAmount > 0) {
          await prisma.feeDeposit.create({
            data: {
              txSignature: sig.signature,
              amount: BigInt(depositAmount),
              source: 'PUMPFUN',
            },
          });
          depositsRecorded++;
        }
      } catch (err) {
        // Skip individual transaction errors
        console.warn(`Failed to process PumpFun tx ${sig.signature}:`, err);
      }
    }

    return depositsRecorded;
  } catch (err) {
    console.error('Failed to check PumpFun fee deposits:', err);
    return 0;
  }
}

/**
 * Check for new deposits to the treasury PDA (deployment fees)
 *
 * @param connection - Solana RPC connection
 * @returns Number of new deposits recorded
 */
export async function checkTreasuryDeposits(connection: Connection): Promise<number> {
  try {
    // Get recent signatures for the treasury PDA
    const signatures = await connection.getSignaturesForAddress(
      TREASURY_PDA,
      { limit: 50 }
    );

    if (signatures.length === 0) {
      return 0;
    }

    // Filter to new signatures
    const existingTxs = await prisma.feeDeposit.findMany({
      where: {
        txSignature: {
          in: signatures.map(s => s.signature),
        },
      },
      select: { txSignature: true },
    });

    const existingSet = new Set(existingTxs.map(t => t.txSignature));
    const newSignatures = signatures.filter(s => !existingSet.has(s.signature));

    if (newSignatures.length === 0) {
      return 0;
    }

    let depositsRecorded = 0;

    // Process each new transaction
    for (const sig of newSignatures) {
      try {
        const tx = await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx) continue;

        // Find SOL transfers to the treasury
        const depositAmount = extractDepositAmount(tx, TREASURY_PDA);

        // Only record deposits (not claims/withdrawals)
        if (depositAmount > 0) {
          // Check if this is a claim transaction (outgoing from treasury)
          // Claims have the treasury as the source, not destination
          const isDeposit = isDepositTransaction(tx, TREASURY_PDA);

          if (isDeposit) {
            await prisma.feeDeposit.create({
              data: {
                txSignature: sig.signature,
                amount: BigInt(depositAmount),
                source: 'DEPLOYMENT',
              },
            });
            depositsRecorded++;
          }
        }
      } catch (err) {
        // Skip individual transaction errors
        console.warn(`Failed to process treasury tx ${sig.signature}:`, err);
      }
    }

    return depositsRecorded;
  } catch (err) {
    console.error('Failed to check treasury deposits:', err);
    return 0;
  }
}

/**
 * Extract deposit amount to a specific address from a transaction
 */
function extractDepositAmount(
  tx: ParsedTransactionWithMeta,
  targetAddress: PublicKey
): number {
  if (!tx.meta) return 0;

  const targetStr = targetAddress.toBase58();

  // Check account keys for the target address
  const accountKeys = tx.transaction.message.accountKeys;
  const targetIndex = accountKeys.findIndex(
    key => key.pubkey.toBase58() === targetStr
  );

  if (targetIndex === -1) return 0;

  // Calculate balance change
  const preBalance = tx.meta.preBalances[targetIndex] || 0;
  const postBalance = tx.meta.postBalances[targetIndex] || 0;
  const balanceChange = postBalance - preBalance;

  // Only return positive changes (deposits)
  return balanceChange > 0 ? balanceChange : 0;
}

/**
 * Check if a transaction is a deposit (vs withdrawal) for the target
 */
function isDepositTransaction(
  tx: ParsedTransactionWithMeta,
  targetAddress: PublicKey
): boolean {
  if (!tx.meta) return false;

  const targetStr = targetAddress.toBase58();
  const accountKeys = tx.transaction.message.accountKeys;
  const targetIndex = accountKeys.findIndex(
    key => key.pubkey.toBase58() === targetStr
  );

  if (targetIndex === -1) return false;

  const preBalance = tx.meta.preBalances[targetIndex] || 0;
  const postBalance = tx.meta.postBalances[targetIndex] || 0;

  // Deposit = balance increased
  return postBalance > preBalance;
}

/**
 * Start the fee monitoring service
 *
 * @param connection - Solana RPC connection
 */
export function startFeeMonitor(connection: Connection): void {
  if (monitorTimer) {
    console.warn('Fee monitor already running');
    return;
  }

  console.log('Fee monitor starting...');
  console.log('  Treasury PDA:', TREASURY_PDA.toBase58());

  if (PUMPFUN_FEE_WALLET) {
    console.log('  PumpFun wallet:', PUMPFUN_FEE_WALLET.toBase58());
  } else {
    console.log('  PumpFun wallet: not configured (PUMPFUN_FEE_WALLET env var not set)');
  }

  // Run initial check
  runFeeCheck(connection);

  // Schedule periodic checks
  monitorTimer = setInterval(() => {
    runFeeCheck(connection);
  }, CHECK_INTERVAL);

  console.log('Fee monitor started');
}

/**
 * Stop the fee monitoring service
 */
export function stopFeeMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
    console.log('Fee monitor stopped');
  }
}

/**
 * Run a single fee check cycle
 */
async function runFeeCheck(connection: Connection): Promise<void> {
  try {
    const [pumpfunDeposits, treasuryDeposits] = await Promise.all([
      checkForFeeDeposits(connection),
      checkTreasuryDeposits(connection),
    ]);

    const total = pumpfunDeposits + treasuryDeposits;
    if (total > 0) {
      console.log(
        `Fee monitor: recorded ${total} new deposits ` +
        `(${treasuryDeposits} treasury, ${pumpfunDeposits} PumpFun)`
      );
    }
  } catch (err) {
    console.error('Fee check cycle failed:', err);
  }
}

/**
 * Get total unprocessed fee pool
 *
 * @returns Total lamports from unprocessed deposits
 */
export async function getTotalFeePool(): Promise<bigint> {
  const result = await prisma.feeDeposit.aggregate({
    where: { processed: false },
    _sum: { amount: true },
  });

  return result._sum.amount ?? BigInt(0);
}

/**
 * Get fee pool summary
 */
export async function getFeePoolSummary(): Promise<{
  totalUnprocessed: bigint;
  deploymentFees: bigint;
  pumpfunFees: bigint;
  depositCount: number;
}> {
  const [deployment, pumpfun, count] = await Promise.all([
    prisma.feeDeposit.aggregate({
      where: { processed: false, source: 'DEPLOYMENT' },
      _sum: { amount: true },
    }),
    prisma.feeDeposit.aggregate({
      where: { processed: false, source: 'PUMPFUN' },
      _sum: { amount: true },
    }),
    prisma.feeDeposit.count({
      where: { processed: false },
    }),
  ]);

  const deploymentFees = deployment._sum.amount ?? BigInt(0);
  const pumpfunFees = pumpfun._sum.amount ?? BigInt(0);

  return {
    totalUnprocessed: deploymentFees + pumpfunFees,
    deploymentFees,
    pumpfunFees,
    depositCount: count,
  };
}
