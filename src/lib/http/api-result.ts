/**
 * The shape every JSON endpoint answers in.
 *
 * One documented envelope, so a second client — the iOS app — never has to
 * guess how a failure arrives. Success carries `data`; failure carries an
 * `error` with a stable machine-readable `code`, a human sentence, and
 * optionally per-field messages for a form to display.
 *
 * These are plain values, not framework responses: the route turns them into
 * one. That keeps the rules testable without a server.
 */

export type ApiErrorCode =
  | 'validation_failed'
  | 'rate_limited'
  | 'location_unknown'
  | 'email_failed'
  | 'invalid_token'
  | 'expired_token'
  | 'malformed_request'
  | 'not_found'
  /** The visitor has no verified identity in this browser yet. */
  | 'not_recognised'
  | 'confirmation_refused'
  | 'internal_error';

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiFailure {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
}

export type ApiBody<T> = ApiSuccess<T> | ApiFailure;

export interface ApiResult<T> {
  status: number;
  body: ApiBody<T>;
  /** Seconds the client should wait, for a 429. */
  retryAfterSeconds?: number;
}

export function success<T>(data: T, status = 200): ApiResult<T> {
  return { status, body: { data } };
}

export function failure(
  code: ApiErrorCode,
  message: string,
  options: { status?: number; fields?: Record<string, string>; retryAfterSeconds?: number } = {},
): ApiResult<never> {
  return {
    status: options.status ?? statusFor(code),
    body: {
      error: {
        code,
        message,
        ...(options.fields ? { fields: options.fields } : {}),
      },
    },
    ...(options.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: options.retryAfterSeconds }
      : {}),
  };
}

function statusFor(code: ApiErrorCode): number {
  switch (code) {
    case 'validation_failed':
    case 'location_unknown':
    case 'malformed_request':
      return 400;
    case 'invalid_token':
    case 'expired_token':
      return 410;
    case 'not_found':
      return 404;
    case 'not_recognised':
      return 403;
    case 'confirmation_refused':
      return 409;
    case 'rate_limited':
      return 429;
    case 'email_failed':
    case 'internal_error':
      return 500;
  }
}
