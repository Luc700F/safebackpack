/**
 * A second opinion on a report, from something that reads rather than matches.
 *
 * The heuristics in `screening.ts` catch what a pattern can catch: links,
 * addresses, shouting. What they cannot judge is whether text is abusive, a
 * threat, or an attack on somebody — that needs a classifier.
 *
 * Kept behind an interface because the ground shifts. Google's Perspective API
 * was the obvious free choice and is being retired at the end of 2026, with
 * new access closed since February. Whichever provider is current, the callers
 * should not have to know.
 */

export interface Classification {
  /** True when the text should go in front of a person. */
  concerning: boolean;
  /** What the classifier objected to, in words a moderator can read. */
  reasons: string[];
}

export interface TextClassifier {
  classify(text: string): Promise<Classification>;
}

/** A classifier with a fixed answer. For tests and for local development. */
export class StaticClassifier implements TextClassifier {
  private readonly answer: Classification;

  constructor(answer: Classification = { concerning: false, reasons: [] }) {
    this.answer = answer;
  }

  async classify(): Promise<Classification> {
    return this.answer;
  }
}
