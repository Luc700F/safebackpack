/**
 * "3 days ago", and when that stops being useful, a date.
 *
 * Shared, because the same phrasing appears on the map card and in the list,
 * and two copies would drift. Beyond a month "47 days ago" tells a reader less
 * than "Jul 2026" does.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatWhen(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const days = Math.floor((now.getTime() - date.getTime()) / MS_PER_DAY);

  if (days < 0) return 'Just now';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;

  return date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
}
