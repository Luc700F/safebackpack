import { NextResponse } from 'next/server';

import { getReportService } from '@/lib/container';
import { failure, success } from '@/lib/http/api-result';
import { RECOGNITION_COOKIE, readCookie } from '@/lib/http/cookies';
import type { ConfirmationKind } from '@/lib/reports/confirmations';

const KINDS = new Set<ConfirmationKind>(['still_valid', 'no_longer_valid']);

/**
 * Says a report still applies, or no longer does.
 *
 * Identity is the recognition token from the reporter's own email
 * verification. Someone who has never filed a report cannot confirm one yet,
 * and the answer says so rather than failing vaguely.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  let payload: { kind?: unknown };
  try {
    payload = (await request.json()) as { kind?: unknown };
  } catch {
    return json(failure('malformed_request', 'Expected a JSON body.'));
  }

  const kind = payload?.kind;
  if (typeof kind !== 'string' || !KINDS.has(kind as ConfirmationKind)) {
    return json(
      failure(
        'validation_failed',
        'Say whether the report still applies or no longer does.',
        { fields: { kind: 'Unknown confirmation type.' } },
      ),
    );
  }

  const outcome = await getReportService().confirm(
    id,
    kind as ConfirmationKind,
    {
      recognitionToken: readCookie(
        request.headers.get('cookie'),
        RECOGNITION_COOKIE,
      ),
    },
  );

  switch (outcome.status) {
    case 'recorded':
      return json(
        success({
          confirmations: outcome.confirmations,
          retirements: outcome.retirements,
          retired: outcome.retired,
        }),
      );

    case 'not_recognised':
      return json(
        failure(
          'not_recognised',
          'File and confirm a report of your own first — that is what lets you vouch for others.',
          { status: 403 },
        ),
      );

    case 'not_found':
      return json(failure('not_found', 'No such report.'));

    case 'rate_limited':
      return json(
        failure('rate_limited', 'That is a lot of confirmations. Try again later.', {
          retryAfterSeconds: Math.ceil(outcome.retryAfterMs / 1000),
        }),
      );

    case 'refused':
      return json(failure('confirmation_refused', refusalMessage(outcome.reason)));
  }
}

function refusalMessage(reason: string): string {
  switch (reason) {
    case 'own_report':
      return 'You cannot vouch for your own report.';
    case 'already_confirmed':
      return 'You have already answered for this report.';
    default:
      return 'This report cannot be confirmed right now.';
  }
}

function json(result: {
  status: number;
  body: unknown;
  retryAfterSeconds?: number;
}): Response {
  const response = NextResponse.json(result.body, { status: result.status });

  if (result.retryAfterSeconds !== undefined) {
    response.headers.set('Retry-After', String(result.retryAfterSeconds));
  }

  return response;
}
