/**
 * Hook for agent deployment flow
 * Handles: request tx -> sign -> send with retry -> confirm -> update store
 *
 * Includes retry logic with priority fee escalation for network congestion.
 */
import { useState, useCallback, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { requestDeployTransaction, confirmDeployment, type Agent } from '../lib/agents';
import { useAgentStore } from '../stores/agentStore';
import { useWalletStore } from '../stores/walletStore';
import { useTransactionToast } from '../components/ui/TransactionStatus';
import {
  estimatePriorityFee,
  createPriorityFeeInstruction,
  createComputeUnitLimitInstruction,
} from '../solana/priorityFees';
import { confirmTransactionUntilExpiry } from '../solana/transactionRetry';

export type DeployStatus = 'idle' | 'requesting' | 'signing' | 'sending' | 'confirming' | 'success' | 'error';

interface UseAgentDeployResult {
  deploy: () => Promise<Agent | null>;
  status: DeployStatus;
  error: string | null;
  isDeploying: boolean;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 500;

export function useAgentDeploy(): UseAgentDeployResult {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { isAuthenticated } = useWalletStore();
  const { addAgent } = useAgentStore();
  const toast = useTransactionToast();

  const [status, setStatus] = useState<DeployStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Track active toast for updates
  const activeToastId = useRef<string | null>(null);

  const deploy = useCallback(async (): Promise<Agent | null> => {
    // Pre-flight checks
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Wallet not connected');
      setStatus('error');
      return null;
    }

    if (!isAuthenticated) {
      setError('Not authenticated');
      setStatus('error');
      return null;
    }

    setError(null);
    activeToastId.current = null;

    try {
      // 1. Request transaction from server
      setStatus('requesting');
      const deployData = await requestDeployTransaction();

      if (deployData.warning) {
        console.warn('Deploy warning:', deployData.warning);
      }

      // 2. Deserialize original transaction
      const originalTransaction = Transaction.from(
        Buffer.from(deployData.transaction, 'base64')
      );

      // Store original instructions for retry
      const originalInstructions = [...originalTransaction.instructions];

      // 3. Retry loop for send + confirm
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Clone transaction for this attempt
          const transaction = new Transaction();
          transaction.recentBlockhash = deployData.blockhash;
          transaction.feePayer = wallet.publicKey;

          // Add priority fee on retries
          if (attempt > 0) {
            const priorityFee = estimatePriorityFee(attempt);
            transaction.add(createComputeUnitLimitInstruction(200_000));
            transaction.add(createPriorityFeeInstruction(priorityFee));

            // Show retry toast
            toast.showRetrying(attempt, priorityFee);
            console.log(`[Deploy] Retry ${attempt} with priority fee ${priorityFee}`);
          }

          // Add original instructions
          transaction.add(...originalInstructions);

          // 4. Sign with wallet
          setStatus('signing');
          if (activeToastId.current) {
            toast.removeToast(activeToastId.current);
          }
          activeToastId.current = toast.showSending();

          const signed = await wallet.signTransaction(transaction);

          // 5. Send to network
          setStatus('sending');
          const signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            maxRetries: 0, // Manual retry control
          });

          // Update toast with signature
          toast.showConfirming(signature, activeToastId.current);

          // 6. Wait for confirmation with expiry tracking
          setStatus('confirming');
          const confirmation = await confirmTransactionUntilExpiry(
            connection,
            signature,
            deployData.lastValidBlockHeight
          );

          if (confirmation.err) {
            throw new Error('Transaction failed on-chain');
          }

          // 7. Tell server to mint cNFT and create agent
          const result = await confirmDeployment(signature);

          if (!result.success) {
            throw new Error('Server confirmation failed');
          }

          // 8. Create agent object for store (use server response data)
          const newAgent: Agent = {
            id: result.agent.id,
            hexId: result.agent.hexId ?? null,
            status: result.agent.hexId ? 'MINING' : 'IDLE',
            deployedAt: new Date().toISOString(),
            agentIndex: result.agent.agentIndex,
            mintAddress: result.agent.mintAddress,
            hex:
              result.agent.hexQ != null && result.agent.hexR != null
                ? {
                    q: result.agent.hexQ,
                    r: result.agent.hexR,
                    resourceType: 'GOLD', // Will be updated via socket
                  }
                : undefined,
          };

          // 9. Update store
          addAgent(newAgent);

          // Show success toast
          toast.showSuccess(signature, activeToastId.current);
          activeToastId.current = null;

          setStatus('success');
          return newAgent;
        } catch (err) {
          // Check if blockhash expired
          const currentHeight = await connection.getBlockHeight('confirmed');
          if (currentHeight > deployData.lastValidBlockHeight) {
            toast.showExpired(activeToastId.current ?? undefined);
            activeToastId.current = null;
            throw new Error('Transaction expired - blockhash too old');
          }

          // If this is the last attempt, throw
          if (attempt === MAX_RETRIES - 1) {
            throw err;
          }

          // Exponential backoff before retry
          console.log(`[Deploy] Attempt ${attempt} failed, retrying...`, err);
          await new Promise((resolve) =>
            setTimeout(resolve, INITIAL_BACKOFF_MS * Math.pow(2, attempt))
          );
        }
      }

      throw new Error('Max retries exceeded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deployment failed';
      setError(message);
      setStatus('error');

      // Show error toast
      toast.showError(message, activeToastId.current ?? undefined);
      activeToastId.current = null;

      console.error('Deploy error:', err);
      return null;
    }
  }, [wallet, connection, isAuthenticated, addAgent, toast]);

  return {
    deploy,
    status,
    error,
    isDeploying: status !== 'idle' && status !== 'success' && status !== 'error',
  };
}
