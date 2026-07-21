/**
 * Zustand store for transaction toast state management
 *
 * Manages toast notifications for transaction status across the app.
 * Supports auto-hide with configurable duration.
 */
import { create } from 'zustand';

/**
 * Toast notification types matching transaction states
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Default auto-hide durations (ms) by toast type.
 *
 * Applied centrally in addToast when a toast does not explicitly set autoHide.
 * QA found success/info toasts dismissed too fast to read; these give the user
 * enough time to notice, scaling up for higher-severity messages.
 *
 * Pass `autoHide: null` to a toast to opt out entirely (manual dismiss only).
 */
export const DEFAULT_TOAST_DURATION: Record<ToastType, number> = {
  info: 6500,
  success: 6500,
  warning: 8000,
  error: 10000,
};

/**
 * Toast notification data
 */
export interface TransactionToast {
  /** Unique identifier */
  id: string;
  /** Toast type determines styling */
  type: ToastType;
  /** Toast title (e.g., "Sending", "Confirmed") */
  title: string;
  /** Toast message with details */
  message: string;
  /** Optional transaction signature for Solscan link */
  signature?: string;
  /**
   * Auto-hide delay in ms.
   * - Omitted (undefined) => a type-based default from DEFAULT_TOAST_DURATION is applied.
   * - `null` => manual dismiss only (sticky until closed).
   * - A number => that exact delay.
   */
  autoHide?: number | null;
}

/**
 * Store state and actions
 */
interface TransactionStore {
  /** Active toast notifications */
  toasts: TransactionToast[];
  /** Add a new toast, returns its ID */
  addToast: (toast: Omit<TransactionToast, 'id'>) => string;
  /** Remove a toast by ID */
  removeToast: (id: string) => void;
  /** Remove all toasts */
  clearToasts: () => void;
  /** Update an existing toast by ID */
  updateToast: (id: string, updates: Partial<Omit<TransactionToast, 'id'>>) => void;
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = crypto.randomUUID();

    // Resolve auto-hide: explicit number wins; `null` means sticky (manual
    // dismiss only); `undefined` falls back to the type-based central default.
    const autoHide =
      toast.autoHide === undefined ? DEFAULT_TOAST_DURATION[toast.type] : toast.autoHide;

    set((state) => ({ toasts: [...state.toasts, { ...toast, id, autoHide }] }));

    // Auto-hide unless sticky (null/0).
    if (autoHide) {
      setTimeout(() => get().removeToast(id), autoHide);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  clearToasts: () => set({ toasts: [] }),

  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },
}));
