/**
 * Generic transaction send/confirm loop with fee escalation.
 *
 * Transaction-agnostic: the caller supplies a `txBuilder` that assembles the
 * instructions for a given attempt. This hook owns the retry loop, priority-fee
 * escalation, signing, raw send, and confirmation-until-expiry logic that was
 * previously inlined in useAgentDeploy / useClaimEarnings.
 */
import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import {
  estimatePriorityFee,
  createPriorityFeeInstruction,
  createComputeUnitLimitInstruction,
} from '../solana/priorityFees';
import { confirmTransactionUntilExpiry } from '../solana/transactionRetry';

export type SendStatus =
  | 'idle'
  | 'signing'
  | 'sending'
  | 'confirming'
  | 'retrying'
  | 'success'
  | 'error';

/** Context passed to the tx builder for each attempt. */
export interface TxBuildContext {
  /** Fee payer public key. */
  feePayer: import('@solana/web3.js').PublicKey;
  /** Blockhash to use for this transaction. */
  blockhash: string;
  /** Current retry attempt (0-indexed). */
  attempt: number;
}

/** Everything the send loop needs to run: instructions + expiry bounds. */
export interface SendPlan {
  /** Base instructions (without priority-fee ixs — those are added per attempt). */
  build: (ctx: TxBuildContext) => import('@solana/web3.js').TransactionInstruction[];
  blockhash: string;
  lastValidBlockHeight: number;
}

export interface SendResult {
  signature: string;
}

export interface UseSendAndConfirmResult {
  send: (plan: SendPlan) => Promise<SendResult | null>;
  status: SendStatus;
  signature: string | null;
  error: string | null;
  /** Current retry attempt (0-indexed); >0 means a fee-escalated retry. */
  attempt: number;
  priorityFee: number | null;
  reset: () => void;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 500;

/**
 * Deserialize a base64 server transaction into its instruction list, ready to
 * be fed back through a SendPlan.build that just returns them.
 */
export function instructionsFromBase64(
  base64: string
): import('@solana/web3.js').TransactionInstruction[] {
  const tx = Transaction.from(Buffer.from(base64, 'base64'));
  return [...tx.instructions];
}

export function useSendAndConfirm(): UseSendAndConfirmResult {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [status, setStatus] = useState<SendStatus>('idle');
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [priorityFee, setPriorityFee] = useState<number | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setSignature(null);
    setError(null);
    setAttempt(0);
    setPriorityFee(null);
  }, []);

  const send = useCallback(
    async (plan: SendPlan): Promise<SendResult | null> => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        setError('Wallet not connected');
        setStatus('error');
        return null;
      }

      const feePayer = wallet.publicKey;
      const signTransaction = wallet.signTransaction;

      setError(null);
      setSignature(null);
      setAttempt(0);
      setPriorityFee(null);

      try {
        for (let currentAttempt = 0; currentAttempt < MAX_RETRIES; currentAttempt++) {
          try {
            setAttempt(currentAttempt);

            const transaction = new Transaction();
            transaction.recentBlockhash = plan.blockhash;
            transaction.feePayer = feePayer;

            // Escalate priority fee on retries.
            if (currentAttempt > 0) {
              const fee = estimatePriorityFee(currentAttempt);
              setPriorityFee(fee);
              setStatus('retrying');
              transaction.add(createComputeUnitLimitInstruction(200_000));
              transaction.add(createPriorityFeeInstruction(fee));
            }

            // Caller-supplied instructions for this attempt.
            transaction.add(
              ...plan.build({ feePayer, blockhash: plan.blockhash, attempt: currentAttempt })
            );

            // Sign.
            setStatus('signing');
            const signed = await signTransaction(transaction);

            // Send.
            setStatus('sending');
            const sig = await connection.sendRawTransaction(signed.serialize(), {
              skipPreflight: false,
              maxRetries: 0,
            });
            setSignature(sig);

            // Confirm with expiry tracking.
            setStatus('confirming');
            const confirmation = await confirmTransactionUntilExpiry(
              connection,
              sig,
              plan.lastValidBlockHeight
            );

            if (confirmation.err) {
              throw new Error('Transaction failed on-chain');
            }

            setStatus('success');
            return { signature: sig };
          } catch (err) {
            // Blockhash expired -> not retryable.
            const currentHeight = await connection.getBlockHeight('confirmed');
            if (currentHeight > plan.lastValidBlockHeight) {
              throw new Error('Transaction expired - blockhash too old');
            }

            if (currentAttempt === MAX_RETRIES - 1) {
              throw err;
            }

            await new Promise((resolve) =>
              setTimeout(resolve, INITIAL_BACKOFF_MS * Math.pow(2, currentAttempt))
            );
          }
        }

        throw new Error('Max retries exceeded');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        setError(message);
        setStatus('error');
        console.error('[useSendAndConfirm] Error:', err);
        return null;
      }
    },
    [wallet.publicKey, wallet.signTransaction, connection]
  );

  return { send, status, signature, error, attempt, priorityFee, reset };
}
