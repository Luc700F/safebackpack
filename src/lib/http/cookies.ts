/**
 * The one cookie SafeBackpack sets.
 *
 * It carries the signed recognition token, nothing else: no analytics, no
 * session, no tracking. Because it is strictly necessary for the feature the
 * visitor just used, it needs no consent banner.
 */

import { ADMIN_SESSION_HOURS } from '../admin/session';
import { RECOGNITION_DAYS } from '../verification/recognition';

export const RECOGNITION_COOKIE = 'sb_recognition';
export const ADMIN_COOKIE = 'sb_moderation';

export interface CookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
}

/**
 * `secure` is off only for plain-http local development; anywhere else the
 * cookie must never travel unencrypted.
 */
export function recognitionCookieOptions(siteUrl: string): CookieOptions {
  return {
    httpOnly: true,
    secure: siteUrl.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: RECOGNITION_DAYS * 24 * 60 * 60,
  };
}

/**
 * The moderation session. Stricter than the recognition cookie: it never needs
 * to survive arriving from another site, so nothing cross-site carries it.
 */
export function adminCookieOptions(siteUrl: string): CookieOptions & {
  sameSite: 'lax';
} {
  return {
    httpOnly: true,
    secure: siteUrl.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_HOURS * 60 * 60,
  };
}

/** Reads one cookie out of a raw `Cookie` header. */
export function readCookie(
  header: string | null,
  name: string,
): string | null {
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim()) || null;
    }
  }

  return null;
}
