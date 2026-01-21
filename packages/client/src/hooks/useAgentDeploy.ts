/**
 * Hook for agent deployment flow
 * Handles: request tx -> sign -> send -> confirm -> update store
 */
import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { requestDeployTransaction, confirmDeployment, type Agent } from '../lib/agents';
import { useAgentStore } from '../stores/agentStore';
import { useWalletStore } from '../stores/walletStore';

export type DeployStatus = 'idle' | 'requesting' | 'signing' | 'sending' | 'confirming' | 'success' | 'error';

interface UseAgentDeployResult {
  deploy: () => Promise<Agent | null>;
  status: DeployStatus;
  error: string | null;
  isDeploying: boolean;
}

export function useAgentDeploy(): UseAgentDeployResult {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { isAuthenticated } = useWalletStore();
  const { addAgent } = useAgentStore();

  const [status, setStatus] = useState<DeployStatus>('idle');
  const [error, setError] = useState<string | null>(null);

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

    try {
      // 1. Request transaction from server
      setStatus('requesting');
      const deployData = await requestDeployTransaction();

      if (deployData.warning) {
        console.warn('Deploy warning:', deployData.warning);
      }

      // 2. Deserialize transaction
      const transaction = Transaction.from(
        Buffer.from(deployData.transaction, 'base64')
      );

      // 3. Sign with wallet
      setStatus('signing');
      const signed = await wallet.signTransaction(transaction);

      // 4. Send to network
      setStatus('sending');
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // 5. Wait for confirmation
      setStatus('confirming');
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: deployData.blockhash,
        lastValidBlockHeight: deployData.lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed on-chain');
      }

      // 6. Tell server to mint cNFT and create agent
      const result = await confirmDeployment(signature);

      if (!result.success) {
        throw new Error('Server confirmation failed');
      }

      // 7. Create agent object for store
      const newAgent: Agent = {
        id: result.agent.id,
        hexId: null,
        status: 'IDLE',
        deployedAt: new Date().toISOString(),
        agentIndex: result.agent.agentIndex,
        mintAddress: result.agent.mintAddress,
      };

      // 8. Update store
      addAgent(newAgent);

      setStatus('success');
      return newAgent;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deployment failed';
      setError(message);
      setStatus('error');
      console.error('Deploy error:', err);
      return null;
    }
  }, [wallet, connection, isAuthenticated, addAgent]);

  return {
    deploy,
    status,
    error,
    isDeploying: status !== 'idle' && status !== 'success' && status !== 'error',
  };
}
