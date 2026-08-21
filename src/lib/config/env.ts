/**
 * Server-side configuration.
 *
 * Grouped by concern rather than read as one block, so a part of the app that
 * needs no database can start without one — while anything that does need it
 * still fails immediately and by name, instead of surfacing later as a
 * confusing runtime error.
 *
 * Secrets are read on the server only. Anything the browser may see must be
 * prefixed `NEXT_PUBLIC_` and passed in deliberately.
 */

export type EnvSource = Record<string, string | undefined>;

export interface SigningConfig {
  /** Signs recognition tokens and keys every hash of personal data. */
  secret: string;
  /** The site's own origin, used to build links inside emails. */
  siteUrl: string;
}

export interface EmailConfig {
  apiKey: string;
  from: string;
}

export interface DatabaseConfig {
  url: string;
}

export interface RateLimitStoreConfig {
  url: string;
  token: string;
}

export class MissingConfigError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(
      `Missing environment variable ${variable}. ` +
        'Copy .env.example to .env.local and fill it in.',
    );
    this.name = 'MissingConfigError';
    this.variable = variable;
  }
}

function required(source: EnvSource, variable: string): string {
  const value = source[variable]?.trim();
  if (!value) {
    throw new MissingConfigError(variable);
  }

  return value;
}

function assertServerSide(): void {
  if (typeof window !== 'undefined') {
    throw new Error('Server configuration must never be read in the browser');
  }
}

export function readSigningConfig(
  source: EnvSource = process.env,
): SigningConfig {
  assertServerSide();

  return {
    secret: required(source, 'RECOGNITION_SECRET'),
    siteUrl: required(source, 'NEXT_PUBLIC_SITE_URL'),
  };
}

export function readEmailConfig(source: EnvSource = process.env): EmailConfig {
  assertServerSide();

  return {
    apiKey: required(source, 'RESEND_API_KEY'),
    from: required(source, 'EMAIL_FROM'),
  };
}

export function readDatabaseConfig(
  source: EnvSource = process.env,
): DatabaseConfig {
  assertServerSide();

  return { url: required(source, 'DATABASE_URL') };
}

export function readRateLimitStoreConfig(
  source: EnvSource = process.env,
): RateLimitStoreConfig {
  assertServerSide();

  return {
    url: required(source, 'UPSTASH_REDIS_REST_URL'),
    token: required(source, 'UPSTASH_REDIS_REST_TOKEN'),
  };
}

/**
 * True when a report can be read by something as well as matched by patterns.
 * Without it the heuristics are the whole of the screening.
 */
export function hasClassifierConfig(source: EnvSource = process.env): boolean {
  return Boolean(source.OPENAI_API_KEY?.trim());
}

export function readClassifierApiKey(source: EnvSource = process.env): string {
  assertServerSide();
  return required(source, 'OPENAI_API_KEY');
}

/**
 * True when abuse limits have somewhere shared to count. Without it they are
 * counted per serverless instance, which on a platform that starts a new one
 * per request means they are not counted at all.
 */
export function hasRateLimitStoreConfig(
  source: EnvSource = process.env,
): boolean {
  return Boolean(
    source.UPSTASH_REDIS_REST_URL?.trim() &&
      source.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

/** True when email can actually be delivered rather than only recorded. */
export function hasEmailConfig(source: EnvSource = process.env): boolean {
  return Boolean(source.RESEND_API_KEY?.trim() && source.EMAIL_FROM?.trim());
}

export function hasDatabaseConfig(source: EnvSource = process.env): boolean {
  return Boolean(source.DATABASE_URL?.trim());
}

const ALL_VARIABLES = [
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'RECOGNITION_SECRET',
  'DATABASE_URL',
  'NEXT_PUBLIC_SITE_URL',
];

/**
 * Every variable that is absent, so setting the project up is one round trip
 * rather than five.
 */
export function missingServerConfig(source: EnvSource = process.env): string[] {
  return ALL_VARIABLES.filter((variable) => !source[variable]?.trim());
}
