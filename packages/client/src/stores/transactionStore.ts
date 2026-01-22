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
  /** Auto-hide delay in ms. Undefined = manual dismiss only */
  autoHide?: number;
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
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

    // Auto-hide if specified
    if (toast.autoHide) {
      setTimeout(() => get().removeToast(id), toast.autoHide);
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
