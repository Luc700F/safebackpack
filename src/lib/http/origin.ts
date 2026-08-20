/**
 * Checking that a mutating request came from our own pages.
 *
 * The recognition cookie is SameSite=Lax, which already stops a cross-site
 * form from carrying it. This is the second line: a request that changes
 * something must say where it came from, and it must be us.
 *
 * Compared against the Host the request arrived on rather than against a
 * reconstructed URL. Behind a proxy those two differ, and comparing the wrong
 * one rejects perfectly good requests — which is how this was first written.
 */

export interface RequestOrigin {
  /** The `Origin` header, if the browser sent one. */
  origin: string | null;
  /** `Host`, or `X-Forwarded-Host` when a proxy rewrote it. */
  host: string | null;
  /** `X-Forwarded-Proto`, when a proxy terminated TLS. */
  forwardedProtocol?: string | null;
}

export function isSameOrigin({
  origin,
  host,
  forwardedProtocol,
}: RequestOrigin): boolean {
  // Browsers omit Origin on some same-origin requests. Nothing to compare
  // against means nothing to reject.
  if (!origin) return true;
  if (!host) return false;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (parsed.host !== host) return false;

  // Where a proxy told us the scheme, an http origin on an https site is a
  // downgrade and not ours.
  if (forwardedProtocol) {
    return parsed.protocol === `${forwardedProtocol}:`;
  }

  return true;
}
