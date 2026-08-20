/**
 * Looking at a report before it reaches the map.
 *
 * The decision is never "reject". It is "publish" or "hold for a person to
 * look at", because an automated judgement on a stranger's account of being
 * robbed should not be final. A held report is invisible, not deleted.
 *
 * The rules here are deliberately narrow. A screener that holds ordinary
 * reports teaches its operator to wave everything through, which is worse than
 * no screening at all. So it looks for things that are almost never innocent
 * in a travel-safety report: contact details, links, and named individuals.
 *
 * Anything cleverer — a language model reading for defamation or distress —
 * fits behind the same interface without touching a caller.
 */

export type ScreeningDecision = 'publish' | 'hold';

export interface ScreeningVerdict {
  decision: ScreeningDecision;
  /** Why it was held. Empty when published. Shown to whoever reviews it. */
  reasons: string[];
}

export interface ScreenableReport {
  description: string;
  customCategoryLabel?: string | null;
}

export interface Screener {
  screen(report: ScreenableReport): Promise<ScreeningVerdict>;
}

const LINK =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|app|ru|cn|xyz|top|shop)\b/i;
const EMAIL = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i;
/** Seven or more digits in a row, or grouped, reads as a phone number. */
const PHONE = /(?:\+?\d[\s()-]?){7,}/;
/**
 * A capitalised name introduced by a word that only ever introduces a person.
 *
 * The obvious rule — two capitalised words in a row — is useless here. In
 * travel writing that is `Khao San Road`, `Grand Palace`, `Chiang Mai`: it
 * held six out of seven realistic reports when it was tried. A screener that
 * holds ordinary reports is worse than none, so this only fires when the text
 * says outright that a person is being named.
 *
 * It will miss a bare `Peter Fischer took our money`. That is the right side
 * to fail on: a missed one is seen by readers who can flag it, while a held
 * one is seen by nobody.
 */
const NAMED_PERSON =
  /\b(?:called|named|name (?:is|was)|mr\.?|mrs\.?|ms\.?|dr\.?|officer|guide|driver named)\s+[A-Z][a-z]{2,}/i;

/**
 * Words that mark abuse rather than a report. Kept short on purpose: a long
 * list catches ordinary language and turns the queue into noise.
 */
const SLURS = ['fuck', 'bitch', 'cunt', 'nigger', 'faggot', 'retard', 'whore'];

export class HeuristicScreener implements Screener {
  async screen(report: ScreenableReport): Promise<ScreeningVerdict> {
    const reasons: string[] = [];
    const text = [report.description, report.customCategoryLabel]
      .filter(Boolean)
      .join('\n');

    if (LINK.test(text)) reasons.push('contains a link');
    if (EMAIL.test(text)) reasons.push('contains an email address');
    if (PHONE.test(text)) reasons.push('contains something like a phone number');
    if (containsSlur(text)) reasons.push('contains abusive language');

    // Naming an individual is the most common way a report turns into an
    // accusation. Held rather than dropped, because whether a name belongs in
    // a report is a judgement no pattern can make.
    if (NAMED_PERSON.test(text)) reasons.push('appears to name a person');

    if (isMostlyShouting(report.description)) {
      reasons.push('written mostly in capitals');
    }

    return { decision: reasons.length > 0 ? 'hold' : 'publish', reasons };
  }
}

function containsSlur(text: string): boolean {
  const words = text.toLowerCase().split(/[^a-z]+/);
  return words.some((word) => SLURS.includes(word));
}

/** More than half the letters upper case, in something long enough to judge. */
function isMostlyShouting(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 30) return false;

  const capitals = letters.replace(/[^A-Z]/g, '').length;
  return capitals / letters.length > 0.5;
}

/** A screener that publishes everything, for tests about something else. */
export class PermissiveScreener implements Screener {
  async screen(): Promise<ScreeningVerdict> {
    return { decision: 'publish', reasons: [] };
  }
}
