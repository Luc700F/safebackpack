/**
 * The heuristics first, then the classifier.
 *
 * In that order for two reasons. The patterns cost nothing and answer
 * instantly, so a report carrying a phone number never needs a network call.
 * And when they already say hold, a second opinion cannot change the outcome —
 * asking anyway would spend a request to learn nothing.
 */

import type { TextClassifier } from './classifier';
import type { ScreenableReport, Screener, ScreeningVerdict } from './screening';

export class CompositeScreener implements Screener {
  private readonly first: Screener;
  private readonly classifier: TextClassifier;

  constructor(first: Screener, classifier: TextClassifier) {
    this.first = first;
    this.classifier = classifier;
  }

  async screen(report: ScreenableReport): Promise<ScreeningVerdict> {
    const verdict = await this.first.screen(report);
    if (verdict.decision === 'hold') return verdict;

    const text = [report.description, report.customCategoryLabel]
      .filter(Boolean)
      .join('\n');

    const classification = await this.classifier.classify(text);
    if (!classification.concerning) return verdict;

    return { decision: 'hold', reasons: classification.reasons };
  }
}
