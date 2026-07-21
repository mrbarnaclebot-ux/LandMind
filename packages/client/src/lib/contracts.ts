/**
 * Engagement-layer API functions (System 4): daily contracts + prospecting.
 *
 * All calls ride the authenticated apiFetch (session cookie + global 401
 * handling). Survey enforces a 5-minute per-user cooldown server-side; the 429
 * response carries `retryAfterMs` so the UI can show a live mm:ss toast.
 */
import { API_URL } from './config';
import { apiFetch } from './apiFetch';
import type {
  ContractsResponse,
  SurveyResponse,
  SurveysResponse,
} from './socketTypes';

/** GET /api/contracts — the player's active daily contract + streak. */
export async function fetchContracts(): Promise<ContractsResponse> {
  const response = await apiFetch(`${API_URL}/api/contracts`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch contracts');
  }
  return response.json();
}

/** GET /api/surveys — all hexes this player has already surveyed. */
export async function fetchSurveys(): Promise<SurveysResponse> {
  const response = await apiFetch(`${API_URL}/api/surveys`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch surveys');
  }
  return response.json();
}

/**
 * Error thrown by `surveyHex` on a non-2xx response. For the 429 cooldown case
 * `retryAfterMs` carries the remaining wait so the UI can show mm:ss.
 */
export class SurveyError extends Error {
  status: number;
  retryAfterMs?: number;
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = 'SurveyError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * POST /api/hexes/survey {q,r} — reveal a hex's hidden richness/affinity.
 * Resolves to the revealed hex on 200; throws SurveyError on the 5-minute
 * cooldown (429, with retryAfterMs) or any other failure.
 */
export async function surveyHex(q: number, r: number): Promise<SurveyResponse> {
  const response = await apiFetch(`${API_URL}/api/hexes/survey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, r }),
  });

  if (!response.ok) {
    let body: any = {};
    try {
      body = await response.json();
    } catch {
      /* no JSON body */
    }
    const retryAfterMs =
      typeof body.retryAfterMs === 'number' ? body.retryAfterMs : undefined;
    const message =
      body.error || body.message || `Survey failed (${response.status})`;
    throw new SurveyError(message, response.status, retryAfterMs);
  }

  return response.json();
}
