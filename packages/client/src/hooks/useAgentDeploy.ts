/**
 * Hook for the agent deployment flow.
 *
 * Thin composition over reusable primitives:
 * - useSendAndConfirm     -> generic retry/fee-escalation send + confirm loop
 * - useTransactionFlowToast -> status-driven toast side effects
 * - lib/agents            -> server request/confirm + Agent assembly
 *
 * Public API is unchanged so DeployButton keeps working.
 */
import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  requestDeployTransaction,
  confirmDeployment,
  buildDeployedAgent,
  type Agent,
} from '../lib/agents';
import { useAgentStore } from '../stores/agentStore';
import { useWalletStore } from '../stores/walletStore';
import { useSendAndConfirm, instructionsFromBase64, type SendStatus } from './useSendAndConfirm';
import { useTransactionFlowToast } from './useTransactionFlowToast';

export type DeployStatus =
  | 'idle'
  | 'requesting'
  | 'signing'
  | 'sending'
  | 'confirming'
  | 'success'
  | 'error';

interface UseAgentDeployResult {
  deploy: () => Promise<Agent | null>;
  status: DeployStatus;
  error: string | null;
  isDeploying: boolean;
}

/** Map the generic send status onto the deploy-specific status union. */
function toDeployStatus(sendStatus: SendStatus, requesting: boolean): DeployStatus {
  if (requesting) return 'requesting';
  switch (sendStatus) {
    case 'idle':
      return 'idle';
    case 'signing':
      return 'signing';
    case 'sending':
      return 'sending';
    case 'retrying':
    case 'confirming':
      return 'confirming';
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

export function useAgentDeploy(): UseAgentDeployResult {
  const wallet = useWallet();
  const { isAuthenticated } = useWalletStore();
  const { addAgent } = useAgentStore();

  const send = useSendAndConfirm();

  const [requesting, setRequesting] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

  // flowError (e.g. server-side confirm failure) forces error status even when
  // the on-chain send itself succeeded, matching the original behaviour.
  const status: DeployStatus = flowError ? 'error' : toDeployStatus(send.status, requesting);
  const error = flowError ?? send.error;

  // Drive toasts from the send flow's status.
  useTransactionFlowToast({
    status: send.status,
    attempt: send.attempt,
    signature: send.signature,
    error,
  });

  const deploy = useCallback(async (): Promise<Agent | null> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setFlowError('Wallet not connected');
      return null;
    }
    if (!isAuthenticated) {
      setFlowError('Not authenticated');
      return null;
    }

    setFlowError(null);
    send.reset();

    try {
      // 1. Request the deploy transaction from the server.
      setRequesting(true);
      const deployData = await requestDeployTransaction();
      if (deployData.warning) {
        console.warn('Deploy warning:', deployData.warning);
      }

      const originalInstructions = instructionsFromBase64(deployData.transaction);
      setRequesting(false);

      // 2. Send + confirm with retry/fee escalation.
      const result = await send.send({
        build: () => originalInstructions,
        blockhash: deployData.blockhash,
        lastValidBlockHeight: deployData.lastValidBlockHeight,
      });

      if (!result) {
        return null;
      }

      // 3. Tell the server to mint the cNFT and create the agent record.
      const confirmation = await confirmDeployment(result.signature);
      if (!confirmation.success) {
        throw new Error('Server confirmation failed');
      }

      // 4. Assemble + store the agent.
      const newAgent = buildDeployedAgent(confirmation);
      addAgent(newAgent);
      return newAgent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deployment failed';
      setFlowError(message);
      console.error('Deploy error:', err);
      return null;
    } finally {
      setRequesting(false);
    }
  }, [wallet.publicKey, wallet.signTransaction, isAuthenticated, addAgent, send]);

  return {
    deploy,
    status,
    error,
    isDeploying: status !== 'idle' && status !== 'success' && status !== 'error',
  };
}
