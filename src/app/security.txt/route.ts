/**
 * Where to send a security report, per RFC 9116.
 *
 * Generated rather than written into `public/`, because the standard requires
 * an `Expires` date and treats the file as invalid once it has passed. A
 * static file would quietly become invalid on a date nobody has in their diary;
 * this one is always a year out from whenever it is asked for.
 *
 * Served at `/.well-known/security.txt` through a rewrite in next.config.ts,
 * which is the location the standard specifies and the one a researcher looks
 * in.
 */

import { NextResponse } from 'next/server';

const CONTACT = 'mailto:hello@safebackpack.app';
const YEAR_IN_MS = 365 * 24 * 60 * 60 * 1000;

export async function GET(): Promise<Response> {
  const expires = new Date(Date.now() + YEAR_IN_MS).toISOString();

  const body = [
    `Contact: ${CONTACT}`,
    `Expires: ${expires}`,
    'Preferred-Languages: en, de',
    'Canonical: https://www.safebackpack.app/.well-known/security.txt',
    '',
    '# SafeBackpack is run by one person, not a security team.',
    '# Reports are read, and you will get an answer — but not within an hour.',
    '# Please do not test against production: reports on the map are read by',
    '# travellers making decisions, and filling it with proof-of-concept',
    '# entries does harm that a screenshot would not.',
    '',
  ].join('\n');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // A day is short enough that a changed contact address takes effect
      // quickly, long enough that this is not generated for every crawler.
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
