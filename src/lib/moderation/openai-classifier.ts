/**
 * Abuse classification through OpenAI's moderation endpoint.
 *
 * Free and unmetered — it does not count against usage limits — and, unlike
 * the obvious alternative, not scheduled for retirement. It answers one
 * question well: is this text abusive, hateful, threatening or sexual. It does
 * not answer whether a report defames somebody or is plausible; those are
 * judgements, and they stay with the heuristics and the moderation queue.
 *
 * A classifier that cannot be reached lets the report through. Somebody else's
 * outage must not stop a traveller reporting a robbery, and the heuristics
 * have already run. The same trade as the rate limiter, and the wrong one for
 * a system where a miss is worse than a delay.
 */

import type { Classification, TextClassifier } from './classifier';

const ENDPOINT = 'https://api.openai.com/v1/moderations';
const MODEL = 'omni-moderation-latest';
const TIMEOUT_MS = 4000;

/**
 * What each flagged category is called in the queue. Categories not listed —
 * self-harm in particular — are deliberately absent: a report describing
 * somebody in danger is exactly what this site is for, and holding it would be
 * the wrong response.
 */
const REASONS: Record<string, string> = {
  harassment: 'reads as harassment',
  'harassment/threatening': 'contains a threat',
  hate: 'reads as hateful',
  'hate/threatening': 'contains a hateful threat',
  violence: 'describes violence graphically',
  'violence/graphic': 'describes violence graphically',
  sexual: 'contains sexual content',
  'sexual/minors': 'contains sexual content involving minors',
  illicit: 'gives instructions for wrongdoing',
  'illicit/violent': 'gives instructions for violence',
};

export interface OpenAiClassifierOptions {
  apiKey: string;
  /** Injectable so tests never reach the network. */
  fetchImpl?: typeof fetch;
}

interface ModerationResponse {
  results?: { flagged?: boolean; categories?: Record<string, boolean> }[];
}

export class OpenAiClassifier implements TextClassifier {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAiClassifierOptions) {
    if (!options.apiKey) {
      throw new Error('Refusing to build a classifier without an API key');
    }

    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async classify(text: string): Promise<Classification> {
    const clean: Classification = { concerning: false, reasons: [] };
    if (!text.trim()) return clean;

    try {
      const response = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL, input: text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) return clean;

      const body = (await response.json()) as ModerationResponse;
      const result = body?.results?.[0];
      if (!result?.flagged) return clean;

      const reasons = Object.entries(result.categories ?? {})
        .filter(([category, flagged]) => flagged && category in REASONS)
        .map(([category]) => REASONS[category]);

      // Flagged only under a category we chose not to act on — self-harm, for
      // instance. Nothing to hold it for.
      if (reasons.length === 0) return clean;

      return { concerning: true, reasons: [...new Set(reasons)] };
    } catch {
      return clean;
    }
  }
}
