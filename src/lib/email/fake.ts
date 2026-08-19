/**
 * An email sender that records instead of delivering. Used by tests, and by
 * local development when no API key is configured.
 */

import {
  EmailDeliveryError,
  type EmailMessage,
  type EmailSender,
} from './types';

export class RecordingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  private failNext = false;

  async send(message: EmailMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new EmailDeliveryError('Simulated delivery failure');
    }

    this.sent.push(message);
  }

  /** Makes the next `send` throw, so callers' error paths can be tested. */
  failOnce(): void {
    this.failNext = true;
  }

  get lastMessage(): EmailMessage | undefined {
    return this.sent.at(-1);
  }

  clear(): void {
    this.sent.length = 0;
    this.failNext = false;
  }
}
