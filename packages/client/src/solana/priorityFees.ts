/**
 * Priority fee calculation and escalation for Solana transactions
 *
 * Used during network congestion to prioritize transaction inclusion.
 * Fees escalate exponentially on retry attempts.
 */
import { ComputeBudgetProgram, TransactionInstruction } from '@solana/web3.js';

// Base priority fee in microLamports (1 microLamport = 0.000001 lamports)
export const BASE_PRIORITY_FEE = 1000;

// Max priority fee cap to prevent overpayment (1M microLamports = 0.001 SOL per CU)
export const MAX_PRIORITY_FEE = 1_000_000;

// Default compute units for transactions
export const DEFAULT_COMPUTE_UNITS = 200_000;

/**
 * Estimate priority fee based on retry attempt number.
 * Uses exponential escalation: BASE * 2^attempt
 *
 * @param retryAttempt - Current retry attempt (0-indexed)
 * @returns Priority fee in microLamports
 *
 * Attempt 0: 1,000 microLamports
 * Attempt 1: 2,000 microLamports
 * Attempt 2: 4,000 microLamports
 * Attempt 3: 8,000 microLamports
 * Attempt 4: 16,000 microLamports
 */
export function estimatePriorityFee(retryAttempt: number): number {
  const fee = BASE_PRIORITY_FEE * Math.pow(2, retryAttempt);
  return Math.min(fee, MAX_PRIORITY_FEE);
}

/**
 * Create a ComputeBudgetProgram instruction to set priority fee.
 *
 * @param microLamports - Priority fee in microLamports per compute unit
 * @returns TransactionInstruction to prepend to transaction
 */
export function createPriorityFeeInstruction(microLamports: number): TransactionInstruction {
  return ComputeBudgetProgram.setComputeUnitPrice({ microLamports });
}

/**
 * Create a ComputeBudgetProgram instruction to set compute unit limit.
 *
 * @param units - Maximum compute units for the transaction
 * @returns TransactionInstruction to prepend to transaction
 */
export function createComputeUnitLimitInstruction(units: number): TransactionInstruction {
  return ComputeBudgetProgram.setComputeUnitLimit({ units });
}

/**
 * Add priority fee instructions to beginning of transaction instructions.
 *
 * @param instructions - Original transaction instructions
 * @param priorityFee - Priority fee in microLamports
 * @param computeUnits - Optional compute unit limit (defaults to 200,000)
 * @returns New instructions array with priority fee prepended
 */
export function addPriorityFeeToInstructions(
  instructions: TransactionInstruction[],
  priorityFee: number,
  computeUnits: number = DEFAULT_COMPUTE_UNITS
): TransactionInstruction[] {
  return [
    createComputeUnitLimitInstruction(computeUnits),
    createPriorityFeeInstruction(priorityFee),
    ...instructions,
  ];
}
