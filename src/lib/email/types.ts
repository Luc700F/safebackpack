/**
 * The contract between the app and whatever actually delivers email.
 *
 * Code that sends mail depends on this interface, never on Resend directly.
 * Tests use the recording sender in `fake.ts`; production uses `resend.ts`.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Always present — never send HTML-only mail. */
  text: string;
  html: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class EmailDeliveryError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.status = status;
  }
}
