/**
 * contractStore — client state for System 4 (Engagement layer).
 *
 * Holds three things, seeded/kept-live by useContracts:
 *  - `contract`: the player's active daily contract (GET /api/contracts).
 *  - `streak`:   resume-not-reset streak count (Egg Inc calendar model).
 *  - `surveys`:  a durable map of hexes this player has prospected, keyed 'q,r'.
 *                Survey knowledge is permanent per hex — once revealed it stays
 *                revealed (GET /api/surveys seeds it; POST /api/hexes/survey adds
 *                to it). The HexTooltip reads this map to show full hex data.
 *
 * All server-authoritative. Progress/target/resourceAmount are decimal strings
 * on the wire; consumers parse to Number for display (values fit in a JS number
 * for the ranges the game uses, and the store keeps the raw strings too).
 */
import { create } from 'zustand';
import type { DailyContract, SurveyedHex } from '../lib/socketTypes';

/** Key a hex by its axial coordinate. */
export function surveyKey(q: number, r: number): string {
  return `${q},${r}`;
}

interface ContractState {
  /** The active daily contract, or null until loaded. */
  contract: DailyContract | null;
  /** Resume-not-reset streak count. */
  streak: number;
  /** Durable surveyed-hex knowledge, keyed 'q,r'. */
  surveys: Map<string, SurveyedHex>;

  /** Seed the contract + streak (GET /api/contracts). */
  setContract: (contract: DailyContract, streak: number) => void;
  /** Advance progress (contract:progress socket event). */
  setProgress: (progress: string, target: string) => void;
  /** Mark completed + bump streak + attach reward (contract:completed). */
  markCompleted: (streak: number, reward: DailyContract['reward']) => void;

  /** Replace the whole surveyed set (GET /api/surveys). */
  setSurveys: (surveys: SurveyedHex[]) => void;
  /** Add / replace one surveyed hex (POST /api/hexes/survey success). */
  addSurvey: (hex: SurveyedHex) => void;
  /** Look up a surveyed hex, or null if not yet surveyed. */
  getSurvey: (q: number, r: number) => SurveyedHex | null;
}

export const useContractStore = create<ContractState>((set, get) => ({
  contract: null,
  streak: 0,
  surveys: new Map(),

  setContract: (contract, streak) => set({ contract, streak }),

  setProgress: (progress, target) =>
    set((state) =>
      state.contract
        ? { contract: { ...state.contract, progress, target } }
        : state,
    ),

  markCompleted: (streak, reward) =>
    set((state) => ({
      streak,
      contract: state.contract
        ? { ...state.contract, completed: true, reward }
        : state.contract,
    })),

  setSurveys: (surveys) => {
    const map = new Map<string, SurveyedHex>();
    for (const h of surveys) map.set(surveyKey(h.q, h.r), h);
    set({ surveys: map });
  },

  addSurvey: (hex) =>
    set((state) => {
      const next = new Map(state.surveys);
      next.set(surveyKey(hex.q, hex.r), hex);
      return { surveys: next };
    }),

  getSurvey: (q, r) => get().surveys.get(surveyKey(q, r)) ?? null,
}));
