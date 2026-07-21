/**
 * Single source of truth for session-cookie attributes.
 *
 * The client and server are deployed on different domains (different Railway
 * subdomains), so every authenticated request is cross-site. A cross-site
 * cookie is only sent by the browser when it is set with `SameSite=None` AND
 * `Secure`. Using `SameSite=Strict` (or even `Lax`) silently drops the cookie
 * on cross-site requests, which 401s every API call and fails socket auth.
 *
 * Behaviour:
 *  - Cross-site (production, or CROSS_SITE_COOKIES=true): sameSite 'none' +
 *    secure true so the browser sends the cookie cross-site over HTTPS.
 *  - Local dev (http): sameSite 'lax' + secure false so localhost flows work
 *    (a 'none'/secure cookie is rejected by browsers over plain http).
 *
 * clearCookie MUST be called with the SAME httpOnly/secure/sameSite options,
 * otherwise the browser will not match and delete the cookie. Use
 * clearCookieOptions() for that.
 */

/**
 * True when session cookies must be cross-site capable: production, or an
 * explicit CROSS_SITE_COOKIES=true override for staging/preview environments
 * that are also split across domains.
 */
export function isCrossSiteCookies(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.CROSS_SITE_COOKIES === 'true'
  );
}

/**
 * Cookie options for res.cookie() when SETTING the session cookie.
 * Callers add cookie-specific fields (e.g. maxAge) on top.
 */
export function cookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'none' | 'lax';
} {
  const crossSite = isCrossSiteCookies();
  return {
    httpOnly: true,
    secure: crossSite,
    sameSite: crossSite ? 'none' : 'lax',
  };
}

/**
 * Cookie options for res.clearCookie(). Must mirror the set-time options
 * (httpOnly/secure/sameSite) so the browser matches and removes the cookie.
 * maxAge/expires are intentionally omitted — clearCookie sets its own expiry.
 */
export function clearCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'none' | 'lax';
} {
  return cookieOptions();
}
