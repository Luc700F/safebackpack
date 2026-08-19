/**
 * The categories a traveller can file a report under.
 *
 * Ids are stored in the database and appear in URLs, so they are permanent:
 * never rename one. Labels are display-only and may change freely.
 */

export type ReportCategoryId =
  | 'robbery'
  | 'theft'
  | 'harassment'
  | 'natural-hazard'
  | 'unrest'
  | 'scam'
  | 'other';

export interface ReportCategory {
  id: ReportCategoryId;
  label: string;
  /** One-line explanation shown under the label in the report form. */
  hint: string;
  /** CSS custom property holding this category's colour, defined in tokens.css. */
  colorToken: string;
  /**
   * How heavily a report of this category weighs on the heatmap, 0 to 1.
   * Severity is not asked of the reporter: the category already implies it.
   * A pickpocketing is inherently less severe than an armed robbery, and any
   * further nuance belongs in the description.
   */
  severity: number;
  /** Whether the reporter must supply their own label for this category. */
  requiresCustomLabel: boolean;
}

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  {
    id: 'robbery',
    label: 'Robbery or assault',
    hint: 'Being threatened, attacked or forcibly robbed.',
    colorToken: '--color-category-robbery',
    severity: 1,
    requiresCustomLabel: false,
  },
  {
    id: 'theft',
    label: 'Pickpocketing or theft',
    hint: 'Belongings taken without force, including bag slashing and scam-assisted theft.',
    colorToken: '--color-category-theft',
    severity: 0.4,
    requiresCustomLabel: false,
  },
  {
    id: 'harassment',
    label: 'Sexual harassment',
    hint: 'Unwanted sexual attention, following, groping or intimidation.',
    colorToken: '--color-category-harassment',
    severity: 0.9,
    requiresCustomLabel: false,
  },
  {
    id: 'natural-hazard',
    label: 'Natural hazard',
    hint: 'Earthquakes, tsunamis, floods, landslides, blocked or washed-out roads.',
    colorToken: '--color-category-natural-hazard',
    severity: 0.7,
    requiresCustomLabel: false,
  },
  {
    id: 'unrest',
    label: 'Demonstrations or unrest',
    hint: 'Protests, roadblocks, strikes or civil disturbance affecting travel.',
    colorToken: '--color-category-unrest',
    severity: 0.5,
    requiresCustomLabel: false,
  },
  {
    id: 'scam',
    label: 'Scam',
    hint: 'Fake officials, rigged taxi meters, card skimming, overcharging.',
    colorToken: '--color-category-scam',
    severity: 0.3,
    requiresCustomLabel: false,
  },
  {
    id: 'other',
    label: 'Something else',
    hint: 'Describe the type of risk in your own words.',
    colorToken: '--color-category-other',
    severity: 0.5,
    requiresCustomLabel: true,
  },
];

const CATEGORIES_BY_ID = new Map<string, ReportCategory>(
  REPORT_CATEGORIES.map((category) => [category.id, category]),
);

export function isReportCategoryId(value: unknown): value is ReportCategoryId {
  return typeof value === 'string' && CATEGORIES_BY_ID.has(value);
}

/** Returns the category, or `undefined` for an unknown id. */
export function findCategory(id: string): ReportCategory | undefined {
  return CATEGORIES_BY_ID.get(id);
}

/**
 * The label to show for a report: the category label, or the reporter's own
 * wording when they chose the free-text category.
 */
export function resolveCategoryLabel(
  id: ReportCategoryId,
  customLabel?: string | null,
): string {
  const category = CATEGORIES_BY_ID.get(id);
  if (!category) {
    throw new Error(`Unknown report category: ${id}`);
  }

  if (category.requiresCustomLabel) {
    const trimmed = customLabel?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : category.label;
  }

  return category.label;
}

/**
 * The heatmap weight of a category. Used instead of asking the reporter for a
 * severity rating, which they cannot judge consistently anyway.
 */
export function severityOf(id: ReportCategoryId): number {
  const category = CATEGORIES_BY_ID.get(id);
  if (!category) {
    throw new Error(`Unknown report category: ${id}`);
  }

  return category.severity;
}
