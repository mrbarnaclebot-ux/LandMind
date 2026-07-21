/**
 * Single source of truth for the JWT signing secret.
 *
 * All modules that sign or verify session JWTs (authMiddleware, routes/auth,
 * socket handshake auth) MUST import the encoded secret from here so a single
 * value is used everywhere.
 *
 * Call assertJwtSecret() once at startup: it fails hard in production if the
 * secret is unset or still the insecure dev default.
 */

/** The old insecure dev default. Must never be used in production. */
export const DEV_JWT_SECRET_DEFAULT = 'dev-jwt-secret-change-in-production';

/** Raw secret string (env or dev default). */
export const JWT_SECRET_STRING = process.env.JWT_SECRET || DEV_JWT_SECRET_DEFAULT;

/** Encoded secret for use with `jose` (jwtVerify / SignJWT). */
export const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING);

/**
 * Cookie name that carries the session JWT. Shared by auth routes, the auth
 * middleware, and the socket handshake middleware.
 */
export const SESSION_COOKIE_NAME = 'session';

/**
 * Validate the JWT secret configuration. In production, throws if the secret
 * is missing or equal to the known dev default. Call at server startup.
 */
export function assertJwtSecret(): void {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_JWT_SECRET_DEFAULT) {
      throw new Error(
        'FATAL: JWT_SECRET must be set to a secure value in production ' +
          '(it is unset or still the insecure dev default).'
      );
    }
  }
}
