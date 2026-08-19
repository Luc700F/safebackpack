import { beforeEach, describe, expect, it } from 'vitest';

import { RecordingEmailSender } from './fake';
import { EmailDeliveryError, type EmailMessage } from './types';

const MESSAGE: EmailMessage = {
  to: 'traveller@example.com',
  subject: 'Confirm your safebackpack report',
  text: 'Confirm here',
  html: '<p>Confirm here</p>',
};

describe('RecordingEmailSender', () => {
  let sender: RecordingEmailSender;

  beforeEach(() => {
    sender = new RecordingEmailSender();
  });

  it('records what it was asked to send', async () => {
    await sender.send(MESSAGE);
    expect(sender.sent).toEqual([MESSAGE]);
    expect(sender.lastMessage).toEqual(MESSAGE);
  });

  it('keeps messages in order', async () => {
    await sender.send({ ...MESSAGE, subject: 'first' });
    await sender.send({ ...MESSAGE, subject: 'second' });
    expect(sender.sent.map((m) => m.subject)).toEqual(['first', 'second']);
  });

  it('has no last message before anything is sent', () => {
    expect(sender.lastMessage).toBeUndefined();
  });

  it('can be made to fail exactly once', async () => {
    sender.failOnce();
    await expect(sender.send(MESSAGE)).rejects.toThrowError(EmailDeliveryError);
    await expect(sender.send(MESSAGE)).resolves.toBeUndefined();
    expect(sender.sent).toHaveLength(1);
  });

  it('does not record a message it failed to send', async () => {
    sender.failOnce();
    await sender.send(MESSAGE).catch(() => undefined);
    expect(sender.sent).toHaveLength(0);
  });

  it('clears its history and its pending failure', async () => {
    await sender.send(MESSAGE);
    sender.failOnce();
    sender.clear();

    expect(sender.sent).toHaveLength(0);
    await expect(sender.send(MESSAGE)).resolves.toBeUndefined();
  });
});
