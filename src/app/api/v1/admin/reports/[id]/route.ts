import { NextResponse } from 'next/server';

import { hasAdminSession } from '@/lib/admin/session';
import { readSigningConfig } from '@/lib/config/env';
import { getReportService } from '@/lib/container';
import { failure, success } from '@/lib/http/api-result';
import { ADMIN_COOKIE, readCookie } from '@/lib/http/cookies';

/** Approves or rejects one held report. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const signing = readSigningConfig();

  if (
    !hasAdminSession(
      readCookie(request.headers.get('cookie'), ADMIN_COOKIE),
      signing.secret,
    )
  ) {
    const result = failure('not_recognised', 'Not signed in.', { status: 401 });
    return NextResponse.json(result.body, { status: result.status });
  }

  const { id } = await params;

  let payload: { action?: unknown };
  try {
    payload = (await request.json()) as { action?: unknown };
  } catch {
    const result = failure('malformed_request', 'Expected a JSON body.');
    return NextResponse.json(result.body, { status: result.status });
  }

  if (payload?.action !== 'approve' && payload?.action !== 'reject') {
    const result = failure('validation_failed', 'Say approve or reject.');
    return NextResponse.json(result.body, { status: result.status });
  }

  const service = getReportService();
  const outcome =
    payload.action === 'approve'
      ? await service.approveHeld(id)
      : await service.rejectHeld(id);

  if (outcome.status === 'not_found') {
    const result = failure('not_found', 'That report is not waiting for review.');
    return NextResponse.json(result.body, { status: result.status });
  }

  return NextResponse.json(success({ action: payload.action }).body);
}
