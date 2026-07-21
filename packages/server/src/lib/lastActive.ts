/**
 * Throttled lastActiveAt tracking (Phase C — offline grace).
 *
 * Records a user's last-seen time on authenticated HTTP requests and on socket
 * subscribe. Used by the cave-in path: hazards only fire on agents whose owner
 * was active within the last 60 min (design anti-pattern rule 1 — never
 * net-negative an offline player).
 *
 * Throttled to at most one DB write per user per minute so a chatty client
 * (polling / many concurrent requests) can't hammer Postgres. The throttle is
 * a per-process in-memory map; a multi-instance deployment simply writes at most
 * once/min PER INSTANCE, which is still bounded and correct for the 60-min grace
 * window. The write is fire-and-forget: it never blocks the request/response.
 */

import { prisma } from './prisma.js';

/** Minimum interval between persisted lastActiveAt writes per user (60s). */
const THROTTLE_MS = 60_000;

// userId -> last epoch ms we persisted lastActiveAt for them.
const lastWrite = new Map<string, number>();

/**
 * Touch a user's lastActiveAt, throttled to ≤1 write/min. Fire-and-forget:
 * errors are swallowed (best-effort telemetry, never fails the caller).
 */
export function touchLastActive(userId: string | undefined, nowMs: number = Date.now()): void {
  if (!userId) return;
  const prev = lastWrite.get(userId);
  if (prev !== undefined && nowMs - prev < THROTTLE_MS) return;
  // Stamp BEFORE the async write so concurrent requests in the same window don't
  // all fire a write while the first is in flight.
  lastWrite.set(userId, nowMs);
  prisma.user
    .update({ where: { id: userId }, data: { lastActiveAt: new Date(nowMs) } })
    .catch(() => {
      // Best-effort: on failure, roll back the throttle stamp so the next request
      // retries the write rather than silently skipping for a full minute.
      if (lastWrite.get(userId) === nowMs) lastWrite.delete(userId);
    });
}
