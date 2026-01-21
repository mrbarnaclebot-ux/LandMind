/**
 * Hook for claiming earnings with wallet signature
 */
import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { useEarningsStore } from '../stores/earningsStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

export function useClaimEarnings() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { setEarnings } = useEarningsStore();

  const [status, setStatus] = useState<ClaimStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [claimedAmount, setClaimedAmount] = useState<string | null>(null);

  /**
   * Execute claim flow:
   * 1. POST /api/earnings/claim to get unsigned transaction
   * 2. Sign with wallet
   * 3. Send transaction
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

    try {
      // 1. Request claim transaction from server
      const claimResponse = await fetch(`${API_BASE_URL}/api/earnings/claim`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!claimResponse.ok) {
        const errorData = await claimResponse.json();
        throw new Error(errorData.message || errorData.error || 'Failed to build claim transaction');
      }

      const claimData: ClaimTransactionResponse = await claimResponse.json();

      // 2. Deserialize and sign transaction
      setStatus('signing');
      const transactionBuffer = Buffer.from(claimData.transaction, 'base64');
      const transaction = Transaction.from(transactionBuffer);

      let signedTransaction: Transaction;
      try {
        signedTransaction = await signTransaction(transaction);
      } catch (signError) {
        // User rejected signature
        setError('Signature required to claim');
        setStatus('error');
        return false;
      }

      // 3. Send transaction
      setStatus('sending');
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        { skipPreflight: false }
      );

      setTxSignature(signature);

      // 4. Wait for confirmation
      setStatus('confirming');
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: claimData.blockhash,
        lastValidBlockHeight: claimData.lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        throw new Error('Transaction failed on-chain');
      }

      // 5. Confirm with server
      const confirmResponse = await fetch(`${API_BASE_URL}/api/earnings/confirm`, {
        method: 'POST',
        credentials: 'include',
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
      const newTotalClaimed = (BigInt(useEarningsStore.getState().totalClaimed) + BigInt(claimData.amount)).toString();
      setEarnings({
        claimable: '0', // Will be refreshed by socket event
        totalClaimed: newTotalClaimed,
        canClaim: false,
      });

      setStatus('success');
      return true;

    } catch (err) {
      console.error('[useClaimEarnings] Error:', err);
      setError(err instanceof Error ? err.message : 'Claim failed');
      setStatus('error');
      return false;
    }
  }, [publicKey, signTransaction, connection, setEarnings]);

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
