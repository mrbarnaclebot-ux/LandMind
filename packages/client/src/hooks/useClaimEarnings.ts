/**
 * Hook for claiming earnings with wallet signature
 *
 * Includes retry logic with priority fee escalation for network congestion.
 */
import { useState, useCallback, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { useEarningsStore } from '../stores/earningsStore';
import { useTransactionToast } from '../components/ui/TransactionStatus';
import {
  estimatePriorityFee,
  createPriorityFeeInstruction,
  createComputeUnitLimitInstruction,
} from '../solana/priorityFees';
import { confirmTransactionUntilExpiry } from '../solana/transactionRetry';
import { API_URL } from '../lib/config';
import { apiFetch } from '../lib/apiFetch';

export type ClaimStatus = 'idle' | 'building' | 'signing' | 'sending' | 'confirming' | 'success' | 'error';

interface ClaimTransactionResponse {
  transaction: string; // base64 serialized
  amount: string;
  merkleRoot: string;
  proofLength: number;
  blockhash: string;
  lastValidBlockHeight: number;
}

interface ClaimConfirmResponse {
  success: boolean;
  claim: {
    id: string;
    amount: string;
    txSignature: string;
    claimedAt: string;
  };
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 500;

export function useClaimEarnings() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { setEarnings } = useEarningsStore();
  const toast = useTransactionToast();

  const [status, setStatus] = useState<ClaimStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [claimedAmount, setClaimedAmount] = useState<string | null>(null);

  // Track active toast for updates
  const activeToastId = useRef<string | null>(null);

  /**
   * Execute claim flow:
   * 1. POST /api/earnings/claim to get unsigned transaction
   * 2. Sign with wallet
   * 3. Send transaction with retry
   * 4. POST /api/earnings/confirm after confirmation
   */
  const claim = useCallback(async (): Promise<boolean> => {
    if (!publicKey || !signTransaction) {
      setError('Wallet not connected');
      setStatus('error');
      return false;
    }

    setStatus('building');
    setError(null);
    setTxSignature(null);
    setClaimedAmount(null);
    activeToastId.current = null;

    try {
      // 1. Request claim transaction from server
      const claimResponse = await apiFetch(`${API_URL}/api/earnings/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!claimResponse.ok) {
        const errorData = await claimResponse.json();
        throw new Error(errorData.message || errorData.error || 'Failed to build claim transaction');
      }

      const claimData: ClaimTransactionResponse = await claimResponse.json();

      // 2. Deserialize original transaction
      const originalTransaction = Transaction.from(Buffer.from(claimData.transaction, 'base64'));

      // Store original instructions for retry
      const originalInstructions = [...originalTransaction.instructions];

      // 3. Retry loop for sign + send + confirm
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Clone transaction for this attempt
          const transaction = new Transaction();
          transaction.recentBlockhash = claimData.blockhash;
          transaction.feePayer = publicKey;

          // Add priority fee on retries
          if (attempt > 0) {
            const priorityFee = estimatePriorityFee(attempt);
            transaction.add(createComputeUnitLimitInstruction(200_000));
            transaction.add(createPriorityFeeInstruction(priorityFee));

            // Show retry toast
            toast.showRetrying(attempt, priorityFee);
            console.log(`[Claim] Retry ${attempt} with priority fee ${priorityFee}`);
          }

          // Add original instructions
          transaction.add(...originalInstructions);

          // 4. Sign with wallet
          setStatus('signing');
          if (activeToastId.current) {
            toast.removeToast(activeToastId.current);
          }
          activeToastId.current = toast.showSending();

          let signedTransaction: Transaction;
          try {
            signedTransaction = await signTransaction(transaction);
          } catch (signError) {
            // User rejected signature - don't retry
            setError('Signature required to claim');
            setStatus('error');
            toast.showError('Signature required to claim', activeToastId.current);
            activeToastId.current = null;
            return false;
          }

          // 5. Send transaction
          setStatus('sending');
          const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
            skipPreflight: false,
            maxRetries: 0, // Manual retry control
          });

          setTxSignature(signature);

          // Update toast with signature
          toast.showConfirming(signature, activeToastId.current);

          // 6. Wait for confirmation with expiry tracking
          setStatus('confirming');
          const confirmation = await confirmTransactionUntilExpiry(
            connection,
            signature,
            claimData.lastValidBlockHeight
          );

          if (confirmation.err) {
            throw new Error('Transaction failed on-chain');
          }

          // 7. Confirm with server
          const confirmResponse = await apiFetch(`${API_URL}/api/earnings/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signature,
              amount: claimData.amount,
            }),
          });

          if (!confirmResponse.ok) {
            const errorData = await confirmResponse.json();
            throw new Error(errorData.error || 'Failed to confirm claim');
          }

          // Parse confirmation response (validates structure)
          await confirmResponse.json() as ClaimConfirmResponse;

          // Update store
          setClaimedAmount(claimData.amount);
          const newTotalClaimed = (
            BigInt(useEarningsStore.getState().totalClaimed) + BigInt(claimData.amount)
          ).toString();
          setEarnings({
            claimable: '0', // Will be refreshed by socket event
            totalClaimed: newTotalClaimed,
            canClaim: false,
          });

          // Show success toast
          toast.showSuccess(signature, activeToastId.current);
          activeToastId.current = null;

          setStatus('success');
          return true;
        } catch (err) {
          // Check if blockhash expired
          const currentHeight = await connection.getBlockHeight('confirmed');
          if (currentHeight > claimData.lastValidBlockHeight) {
            toast.showExpired(activeToastId.current ?? undefined);
            activeToastId.current = null;
            throw new Error('Transaction expired - blockhash too old');
          }

          // If this is the last attempt, throw
          if (attempt === MAX_RETRIES - 1) {
            throw err;
          }

          // Exponential backoff before retry
          console.log(`[Claim] Attempt ${attempt} failed, retrying...`, err);
          await new Promise((resolve) =>
            setTimeout(resolve, INITIAL_BACKOFF_MS * Math.pow(2, attempt))
          );
        }
      }

      throw new Error('Max retries exceeded');
    } catch (err) {
      console.error('[useClaimEarnings] Error:', err);
      const message = err instanceof Error ? err.message : 'Claim failed';
      setError(message);
      setStatus('error');

      // Show error toast
      toast.showError(message, activeToastId.current ?? undefined);
      activeToastId.current = null;

      return false;
    }
  }, [publicKey, signTransaction, connection, setEarnings, toast]);

  /**
   * Reset state to idle
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxSignature(null);
    setClaimedAmount(null);
  }, []);

  return {
    // State
    status,
    error,
    txSignature,
    claimedAmount,
    isProcessing: ['building', 'signing', 'sending', 'confirming'].includes(status),

    // Actions
    claim,
    reset,
  };
}
