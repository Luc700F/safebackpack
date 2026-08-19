/**
 * Server-side configuration.
 *
 * Reads once, validates loudly, and never hands a raw `process.env` around.
 * A missing secret fails at the first call with a message naming the variable,
 * rather than surfacing later as a confusing runtime error.
 *
 * Secrets are read on the server only. Anything the browser may see must be
 * prefixed `NEXT_PUBLIC_` and belongs in `publicConfig` below.
 */

export interface ServerConfig {
  resendApiKey: string;
  emailFrom: string;
  recognitionSecret: string;
  databaseUrl: string;
  siteUrl: string;
}

export class MissingConfigError extends Error {
  constructor(public readonly variable: string) {
    super(
      `Missing environment variable ${variable}. ` +
        'Copy .env.example to .env.local and fill it in.',
    );
    this.name = 'MissingConfigError';
  }
}

function required(
  source: Record<string, string | undefined>,
  variable: string,
): string {
  const value = source[variable]?.trim();
  if (!value) {
    throw new MissingConfigError(variable);
  }

  return value;
}

/**
 * Builds the server configuration. `source` is injectable so tests never have
 * to mutate the real environment.
 */
export function readServerConfig(
  source: Record<string, string | undefined> = process.env,
): ServerConfig {
  if (typeof window !== 'undefined') {
    throw new Error('Server configuration must never be read in the browser');
  }

  return {
    resendApiKey: required(source, 'RESEND_API_KEY'),
    emailFrom: required(source, 'EMAIL_FROM'),
    recognitionSecret: required(source, 'RECOGNITION_SECRET'),
    databaseUrl: required(source, 'DATABASE_URL'),
    siteUrl: required(source, 'NEXT_PUBLIC_SITE_URL'),
  };
}

/**
 * Reports every missing variable at once, so setting the project up is one
 * round trip rather than five.
 */
export function missingServerConfig(
  source: Record<string, string | undefined> = process.env,
): string[] {
  const variables = [
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'RECOGNITION_SECRET',
    'DATABASE_URL',
    'NEXT_PUBLIC_SITE_URL',
  ];

  return variables.filter((variable) => !source[variable]?.trim());
}
