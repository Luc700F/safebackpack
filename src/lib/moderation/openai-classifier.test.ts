// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { OpenAiClassifier } from './openai-classifier';

function respond(result: unknown) {
  return new Response(JSON.stringify({ results: [result] }), { status: 200 });
}

function classifier(fetchImpl: unknown) {
  return new OpenAiClassifier({
    apiKey: 'sk-test',
    fetchImpl: fetchImpl as typeof fetch,
  });
}

const CLEAN = { concerning: false, reasons: [] };

describe('construction', () => {
  it('refuses to exist without a key', () => {
    expect(() => new OpenAiClassifier({ apiKey: '' })).toThrowError(
      /without an API key/,
    );
  });
});

describe('classify', () => {
  it('passes clean text', async () => {
    await expect(
      classifier(async () => respond({ flagged: false, categories: {} })).classify(
        'Two men grabbed my bag near the market.',
      ),
    ).resolves.toEqual(CLEAN);
  });

  it('flags text the model objects to, in readable words', async () => {
    const verdict = await classifier(async () =>
      respond({ flagged: true, categories: { harassment: true, hate: false } }),
    ).classify('something abusive');

    expect(verdict.concerning).toBe(true);
    expect(verdict.reasons).toEqual(['reads as harassment']);
  });

  it('reports every category it objected to, without repeating itself', async () => {
    const verdict = await classifier(async () =>
      respond({
        flagged: true,
        categories: { violence: true, 'violence/graphic': true, hate: true },
      }),
    ).classify('something');

    // Both violence categories map to the same sentence.
    expect(verdict.reasons).toEqual([
      'describes violence graphically',
      'reads as hateful',
    ]);
  });

  it('lets a report about somebody in danger through', async () => {
    // Self-harm is not in the list on purpose: a report describing somebody in
    // danger is what this site exists for.
    await expect(
      classifier(async () =>
        respond({
          flagged: true,
          categories: { 'self-harm': true, 'self-harm/intent': true },
        }),
      ).classify('a person on the bridge looked like they were about to jump'),
    ).resolves.toEqual(CLEAN);
  });

  it('sends the text to the moderation model', async () => {
    const fetchImpl = vi.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        expect(String(url)).toBe('https://api.openai.com/v1/moderations');
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe('omni-moderation-latest');
        expect(body.input).toBe('the text');
        return respond({ flagged: false });
      },
    );

    await classifier(fetchImpl).classify('the text');
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('authenticates with the key', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer sk-test');
        return respond({ flagged: false });
      },
    );

    await classifier(fetchImpl).classify('the text');
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('does not spend a request on empty text', async () => {
    const fetchImpl = vi.fn(async () => respond({ flagged: true }));

    await expect(classifier(fetchImpl).classify('   ')).resolves.toEqual(CLEAN);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('lets the report through when the classifier is unreachable', async () => {
    await expect(
      classifier(async () => {
        throw new Error('ECONNREFUSED');
      }).classify('the text'),
    ).resolves.toEqual(CLEAN);
  });

  it('lets the report through when the classifier errors', async () => {
    await expect(
      classifier(async () => new Response('nope', { status: 500 })).classify(
        'the text',
      ),
    ).resolves.toEqual(CLEAN);
  });

  it('lets the report through when the answer makes no sense', async () => {
    await expect(
      classifier(async () => new Response('<html>', { status: 200 })).classify(
        'the text',
      ),
    ).resolves.toEqual(CLEAN);
  });

  it('never puts the key into anything it returns', async () => {
    const verdict = await classifier(async () =>
      respond({ flagged: true, categories: { hate: true } }),
    ).classify('the text');

    expect(JSON.stringify(verdict)).not.toContain('sk-test');
  });
});
