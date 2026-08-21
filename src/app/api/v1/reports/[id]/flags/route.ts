import { NextResponse } from 'next/server';

import { readSigningConfig } from '@/lib/config/env';
import { getReportService } from '@/lib/container';
import { failure, success } from '@/lib/http/api-result';
import { hashClientAddress, readClientAddress } from '@/lib/http/client-address';
import { isFlagReason } from '@/lib/reports/flags';

/**
 * Raises a reader's objection to a published report.
 *
 * Open to anyone, with no verified address: a flag asks a person to look, and
 * requiring an account would mean the people a report is about are the least
 * able to question it. One machine counts once per report.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  let payload: { reason?: unknown };
  try {
    payload = (await request.json()) as { reason?: unknown };
  } catch {
    return json(failure('malformed_request', 'Expected a JSON body.'));
  }

  if (!isFlagReason(payload?.reason)) {
    return json(
      failure('validation_failed', 'Say what is wrong with the report.', {
        fields: { reason: 'Unknown reason.' },
      }),
    );
  }

  const outcome = await getReportService().flag(id, payload.reason, {
    ipHash: hashClientAddress(
      readClientAddress(request.headers),
      readSigningConfig().secret,
    ),
  });

  switch (outcome.status) {
    case 'recorded':
      // The count is deliberately not returned: knowing how close a report is
      // to disappearing is exactly what somebody gaming it would want.
      return json(success({ recorded: true }));

    case 'not_found':
      return json(failure('not_found', 'No such report.'));

    case 'rate_limited':
      return json(
        failure('rate_limited', 'That is a lot of reports. Try again later.', {
          retryAfterSeconds: Math.ceil(outcome.retryAfterMs / 1000),
        }),
      );
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
