import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';

export interface TransactionInfo {
  signature: string;
  blockTime: number | null;
  slot: number;
  status: 'success' | 'failed';
  type: 'deploy' | 'claim' | 'transfer' | 'unknown';
  amount: number | null; // SOL amount if applicable
  programId: string | null;
}

// LandMind program ID - will be set after contract deployment
// For now, show all transactions (filtering will work once we have program ID)
const LANDMIND_PROGRAM_ID = import.meta.env.VITE_LANDMIND_PROGRAM_ID || null;

/**
 * Fetch transaction history for a wallet address.
 * Returns recent transactions, optionally filtered to LandMind program only.
 */
export async function fetchTransactionHistory(
  connection: Connection,
  publicKey: PublicKey,
  limit: number = 20,
  filterLandMind: boolean = true
): Promise<TransactionInfo[]> {
  // Get signatures for address
  const signatures = await connection.getSignaturesForAddress(
    publicKey,
    { limit: filterLandMind && LANDMIND_PROGRAM_ID ? limit * 5 : limit }
  );

  if (signatures.length === 0) {
    return [];
  }

  // Fetch parsed transaction details
  const transactions = await connection.getParsedTransactions(
    signatures.map(sig => sig.signature),
    { maxSupportedTransactionVersion: 0 }
  );

  // Parse and filter transactions
  const parsed = signatures.map((sig, index): TransactionInfo | null => {
    const tx = transactions[index];
    if (!tx) return null;

    const info = parseTransaction(tx, sig.signature);

    // Filter to LandMind transactions if enabled and program ID is set
    if (filterLandMind && LANDMIND_PROGRAM_ID) {
      const programIds = extractProgramIds(tx);
      if (!programIds.includes(LANDMIND_PROGRAM_ID)) {
        return null;
      }
    }

    return info;
  });

  // Remove nulls and limit results
  return parsed
    .filter((tx): tx is TransactionInfo => tx !== null)
    .slice(0, limit);
}

/**
 * Parse a transaction into display format.
 */
function parseTransaction(
  tx: ParsedTransactionWithMeta,
  signature: string
): TransactionInfo {
  const meta = tx.meta;
  const blockTime = tx.blockTime;
  const slot = tx.slot;
  const status = meta?.err ? 'failed' : 'success';

  // Determine transaction type based on instructions
  const type = determineTransactionType(tx);

  // Calculate SOL amount change (simplified)
  const amount = calculateSolChange(tx);

  // Get primary program ID
  const programIds = extractProgramIds(tx);

  return {
    signature,
    blockTime,
    slot,
    status,
    type,
    amount,
    programId: programIds[0] || null
  };
}

/**
 * Determine transaction type from instructions.
 * Will be enhanced when LandMind program is deployed.
 */
function determineTransactionType(tx: ParsedTransactionWithMeta): TransactionInfo['type'] {
  const instructions = tx.transaction.message.instructions;

  for (const ix of instructions) {
    // Check for known program patterns
    if ('program' in ix) {
      // System program transfer
      if (ix.program === 'system' && 'parsed' in ix && ix.parsed?.type === 'transfer') {
        return 'transfer';
      }
    }

    // When LandMind program is deployed, add detection here:
    // if ('programId' in ix && ix.programId.toBase58() === LANDMIND_PROGRAM_ID) {
    //   const ixData = ix.data; // Parse instruction data to determine deploy vs claim
    //   return ixData.startsWith('deploy') ? 'deploy' : 'claim';
    // }
  }

  return 'unknown';
}

/**
 * Extract all program IDs from a transaction.
 */
function extractProgramIds(tx: ParsedTransactionWithMeta): string[] {
  const programIds = new Set<string>();

  for (const ix of tx.transaction.message.instructions) {
    if ('programId' in ix) {
      programIds.add(ix.programId.toBase58());
    } else if ('program' in ix) {
      // Parsed instructions have program name, not ID
      // Map known programs to IDs
      if (ix.program === 'system') {
        programIds.add('11111111111111111111111111111111');
      }
    }
  }

  return Array.from(programIds);
}

/**
 * Calculate SOL amount change from transaction.
 */
function calculateSolChange(tx: ParsedTransactionWithMeta): number | null {
  const meta = tx.meta;
  if (!meta) return null;

  const preBalance = meta.preBalances[0] || 0;
  const postBalance = meta.postBalances[0] || 0;
  const fee = meta.fee || 0;

  // Amount sent (negative) or received (positive), excluding fee
  const change = (postBalance - preBalance + fee) / 1e9;

  // Only return if there was a meaningful change
  if (Math.abs(change) < 0.000001) return null;

  return change;
}

/**
 * Format timestamp for display.
 */
export function formatTimestamp(blockTime: number | null): string {
  if (!blockTime) return 'Unknown';

  const date = new Date(blockTime * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
