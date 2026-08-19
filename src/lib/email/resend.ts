/**
 * Delivery through Resend's HTTP API.
 *
 * Called through `fetch` rather than the vendor SDK: the request is four lines,
 * and it keeps a dependency — plus its transitive tree — out of the project.
 *
 * The API key never appears in an error message or a log line.
 */

import {
  EmailDeliveryError,
  type EmailMessage,
  type EmailSender,
} from './types';

const ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

export interface ResendOptions {
  apiKey: string;
  from: string;
  /** Injectable so tests never reach the network. */
  fetchImpl?: typeof fetch;
}

export class ResendEmailSender implements EmailSender {
  private readonly options: ResendOptions;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ResendOptions) {
    if (!options.apiKey) {
      throw new Error('Refusing to construct an email sender without an API key');
    }

    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(message: EmailMessage): Promise<void> {
    const response = await this.post(message);

    if (!response.ok) {
      throw new EmailDeliveryError(
        `Resend rejected the message: ${await describe(response)}`,
        response.status,
      );
    }
  }

  private async post(message: EmailMessage): Promise<Response> {
    const signal = AbortSignal.timeout(TIMEOUT_MS);

    try {
      return await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal,
      });
    } catch (cause) {
      // Never surface the raw error: it can carry request details.
      throw new EmailDeliveryError(
        cause instanceof Error && cause.name === 'TimeoutError'
          ? 'Resend did not respond in time'
          : 'Could not reach Resend',
      );
    }
  }
}

/** Extracts Resend's own explanation, without ever echoing the request back. */
async function describe(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; name?: string };
    return body.message ?? body.name ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}
