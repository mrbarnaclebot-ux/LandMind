/**
 * Drives transaction-status toasts off the status emitted by useSendAndConfirm.
 *
 * Extracted from useAgentDeploy so the send loop stays free of UI side effects.
 * The hook watches (status, attempt, signature, error) and fires the matching
 * toast transitions, tracking the active toast id across the flow.
 */
import { useEffect, useRef } from 'react';
import { useTransactionToast } from '../components/ui/TransactionStatus';
import { estimatePriorityFee } from '../solana/priorityFees';
import type { SendStatus } from './useSendAndConfirm';

interface FlowState {
  status: SendStatus;
  attempt: number;
  signature: string | null;
  error: string | null;
}

/**
 * Subscribe to a send flow's status and render toasts for it.
 */
export function useTransactionFlowToast({ status, attempt, signature, error }: FlowState) {
  const toast = useTransactionToast();
  const activeToastId = useRef<string | null>(null);
  const prevStatus = useRef<SendStatus>('idle');
  const shownRetry = useRef<number>(-1);

  useEffect(() => {
    const prev = prevStatus.current;

    switch (status) {
      case 'idle':
        activeToastId.current = null;
        shownRetry.current = -1;
        break;

      case 'retrying':
        // Show one retry toast per attempt escalation.
        if (attempt > 0 && shownRetry.current !== attempt) {
          shownRetry.current = attempt;
          toast.showRetrying(attempt, estimatePriorityFee(attempt));
        }
        break;

      case 'signing':
        // Start (or restart) the primary "sending" toast for this attempt.
        if (activeToastId.current) {
          toast.removeToast(activeToastId.current);
        }
        activeToastId.current = toast.showSending();
        break;

      case 'confirming':
        if (signature) {
          activeToastId.current = toast.showConfirming(
            signature,
            activeToastId.current ?? undefined
          );
        }
        break;

      case 'success':
        if (signature) {
          toast.showSuccess(signature, activeToastId.current ?? undefined);
        }
        activeToastId.current = null;
        break;

      case 'error':
        if (prev !== 'error') {
          const message = error ?? 'Transaction failed';
          if (message.includes('expired')) {
            toast.showExpired(activeToastId.current ?? undefined);
          } else {
            toast.showError(message, activeToastId.current ?? undefined);
          }
          activeToastId.current = null;
        }
        break;

      default:
        break;
    }

    prevStatus.current = status;
    // toast methods are stable useCallback refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, attempt, signature, error]);
}
