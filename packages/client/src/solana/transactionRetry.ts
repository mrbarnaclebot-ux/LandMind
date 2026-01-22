/**
 * Transaction retry logic with blockhash expiration tracking
 *
 * Handles automatic retry with exponential backoff and priority fee
 * escalation for Solana mainnet congestion scenarios.
 */
import { Connection, Transaction, Signer } from '@solana/web3.js';
import { estimatePriorityFee, createPriorityFeeInstruction, createComputeUnitLimitInstruction } from './priorityFees';

/**
 * Configuration for transaction retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds (default: 500) */
  initialBackoffMs?: number;
  /** Callback when a retry is attempted */
  onRetry?: (attempt: number, priorityFee: number) => void;
  /** Callback when transaction status changes */
  onStatusChange?: (status: TransactionStatus) => void;
}

/**
 * Transaction status union type for status tracking
 */
export type TransactionStatus =
  | { status: 'sending' }
  | { status: 'confirming'; signature: string }
  | { status: 'retrying'; attempt: number; priorityFee: number }
  | { status: 'confirmed'; signature: string }
  | { status: 'expired' }
  | { status: 'failed'; error: string };

/**
 * Default configuration values
 */
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_BACKOFF_MS = 500;
const CONFIRMATION_POLL_INTERVAL_MS = 500;

/**
 * Send a transaction with automatic retry and priority fee escalation.
 *
 * Features:
 * - Retries up to maxRetries times on failure
 * - Exponential backoff between attempts
 * - Priority fees escalate with each retry
 * - Blockhash expiration tracking
 * - Status callbacks for UI updates
 *
 * @param connection - Solana connection
 * @param transaction - Transaction to send (will be modified on retry)
 * @param signers - Signers for the transaction
 * @param config - Retry configuration
 * @returns Transaction signature on success
 * @throws Error on all retries exhausted or blockhash expiration
 */
export async function sendTransactionWithRetry(
  connection: Connection,
  transaction: Transaction,
  signers: Signer[],
  config: RetryConfig = {}
): Promise<string> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
    onRetry,
    onStatusChange,
  } = config;

  // Get blockhash with lastValidBlockHeight for expiration tracking
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  transaction.recentBlockhash = blockhash;
  transaction.feePayer = signers[0].publicKey;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Clone transaction for modification on retry
      const txToSend = Transaction.from(transaction.serialize({ requireAllSignatures: false }));

      // Add priority fee on retries (not first attempt)
      if (attempt > 0) {
        const priorityFee = estimatePriorityFee(attempt);
        const computeUnitIx = createComputeUnitLimitInstruction(200_000);
        const priorityIx = createPriorityFeeInstruction(priorityFee);
        txToSend.instructions = [computeUnitIx, priorityIx, ...txToSend.instructions];
        txToSend.recentBlockhash = blockhash; // Re-set after modification

        onRetry?.(attempt, priorityFee);
        onStatusChange?.({ status: 'retrying', attempt, priorityFee });
      } else {
        onStatusChange?.({ status: 'sending' });
      }

      // Sign transaction
      txToSend.sign(...signers);

      // Send with maxRetries=0 for manual retry control
      const signature = await connection.sendRawTransaction(txToSend.serialize(), {
        skipPreflight: false,
        maxRetries: 0,
      });

      onStatusChange?.({ status: 'confirming', signature });

      // Poll for confirmation until blockhash expires
      const confirmation = await confirmTransactionUntilExpiry(
        connection,
        signature,
        lastValidBlockHeight
      );

      if (confirmation.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.err)}`);
      }

      onStatusChange?.({ status: 'confirmed', signature });
      return signature;
    } catch (error) {
      // Check if blockhash expired
      const currentHeight = await connection.getBlockHeight('confirmed');
      if (currentHeight > lastValidBlockHeight) {
        onStatusChange?.({ status: 'expired' });
        throw new Error('Transaction expired - blockhash too old');
      }

      // Last attempt - throw error
      if (attempt === maxRetries - 1) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange?.({ status: 'failed', error: errorMsg });
        throw error;
      }

      // Exponential backoff before retry
      await new Promise((resolve) => setTimeout(resolve, initialBackoffMs * Math.pow(2, attempt)));
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Poll for transaction confirmation until blockhash expires.
 *
 * @param connection - Solana connection
 * @param signature - Transaction signature to check
 * @param lastValidBlockHeight - Block height when blockhash expires
 * @param pollIntervalMs - Polling interval (default: 500ms)
 * @returns Confirmation result with error field
 * @throws Error if blockhash expires before confirmation
 */
export async function confirmTransactionUntilExpiry(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
  pollIntervalMs: number = CONFIRMATION_POLL_INTERVAL_MS
): Promise<{ err: unknown }> {
  while (true) {
    // Check block height first
    const currentHeight = await connection.getBlockHeight('confirmed');
    if (currentHeight > lastValidBlockHeight) {
      throw new Error('Blockhash expired before confirmation');
    }

    // Check transaction status
    const response = await connection.getSignatureStatus(signature);

    if (
      response?.value?.confirmationStatus === 'confirmed' ||
      response?.value?.confirmationStatus === 'finalized'
    ) {
      return { err: response.value.err };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
