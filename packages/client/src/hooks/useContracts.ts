/**
 * useContracts — wires the engagement store (System 4) to its data sources.
 *
 *  1. On auth, fetch GET /api/contracts (active contract + streak) and
 *     GET /api/surveys (durable surveyed-hex knowledge) into contractStore.
 *  2. Subscribe to the owner-room socket events:
 *       - `contract:progress {progress, target}` → advance the progress bar.
 *       - `contract:completed {streak, reward}`  → flip the card to completed,
 *         bump the streak, and fire a celebration toast.
 *
 * The socket is opened anonymously pre-login and only joins the owner room after
 * `subscribe` acks OK (mirrors useEarnings). We (re)subscribe on connect so a
 * reconnect that carries the session cookie re-joins the room; useEarnings owns
 * the primary subscribe, but re-emitting here is idempotent and safe.
 *
 * Mount ONCE near the app root (App.tsx), alongside useWorldClock.
 */
import { useEffect, useCallback } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useContractStore } from '../stores/contractStore';
import { useTransactionStore } from '../stores/transactionStore';
import { fetchContracts, fetchSurveys } from '../lib/contracts';
import { getSocket } from '../lib/socket';
import type {
  ContractProgressEvent,
  ContractCompletedEvent,
} from '../lib/socketTypes';

export function useContracts(): void {
  const isAuthenticated = useWalletStore((s) => s.isAuthenticated);
  const walletAddress = useWalletStore((s) => s.walletAddress);

  const load = useCallback(async () => {
    if (!useWalletStore.getState().isAuthenticated) return;
    const { setContract, setSurveys } = useContractStore.getState();
    try {
      const [contracts, surveys] = await Promise.all([
        fetchContracts().catch((err) => {
          console.error('[useContracts] contracts fetch failed:', err);
          return null;
        }),
        fetchSurveys().catch((err) => {
          console.error('[useContracts] surveys fetch failed:', err);
          return null;
        }),
      ]);
      if (contracts?.contract) setContract(contracts.contract, contracts.streak ?? 0);
      if (surveys?.surveys) setSurveys(surveys.surveys);
    } catch (err) {
      console.error('[useContracts] load error:', err);
    }
  }, []);

  // Load on auth.
  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  // Owner-room socket events.
  useEffect(() => {
    if (!isAuthenticated || !walletAddress) return;

    const sock = getSocket();

    // Re-join the owner room on (re)connect + reconcile any missed state.
    const subscribe = () => {
      sock.emit('subscribe', walletAddress, (ack) => {
        const ok = typeof ack === 'boolean' ? ack : ack?.ok;
        if (ok) void load();
      });
    };
    if (sock.connected) subscribe();
    sock.on('connect', subscribe);

    const onProgress = (data: ContractProgressEvent) => {
      useContractStore.getState().setProgress(data.progress, data.target);
    };

    const onCompleted = (data: ContractCompletedEvent) => {
      useContractStore.getState().markCompleted(data.streak, data.reward);
      const boost = data.reward?.yieldBoost ?? 1.1;
      useTransactionStore.getState().addToast({
        type: 'success',
        title: 'CONTRACT COMPLETE',
        message: `Daily contract done — ×${boost} until 00:00 UTC · streak ${data.streak}`,
        autoHide: 6000,
      });
    };

    sock.on('contract:progress', onProgress);
    sock.on('contract:completed', onCompleted);

    return () => {
      sock.off('connect', subscribe);
      sock.off('contract:progress', onProgress);
      sock.off('contract:completed', onCompleted);
    };
  }, [isAuthenticated, walletAddress, load]);
}
