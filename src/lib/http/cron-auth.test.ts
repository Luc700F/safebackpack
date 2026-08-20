// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { isAuthorisedCron } from './cron-auth';

const SECRET = 'a-long-scheduler-secret';

describe('isAuthorisedCron', () => {
  it('lets the scheduler through', () => {
    expect(isAuthorisedCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it('refuses a wrong secret', () => {
    expect(isAuthorisedCron('Bearer wrong-secret-value', SECRET)).toBe(false);
  });

  it('refuses a secret that is merely a prefix of the right one', () => {
    expect(isAuthorisedCron('Bearer a-long', SECRET)).toBe(false);
  });

  it('closes the endpoint when no secret is configured', () => {
    expect(isAuthorisedCron(`Bearer ${SECRET}`, undefined)).toBe(false);
    expect(isAuthorisedCron('Bearer anything', '')).toBe(false);
  });

  it.each([[null], [''], ['Basic abc'], [SECRET], ['bearer ' + SECRET]])(
    'refuses the malformed header %p',
    (header) => {
      expect(isAuthorisedCron(header, SECRET)).toBe(false);
    },
  );
});
