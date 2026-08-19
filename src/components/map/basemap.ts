/**
 * The map background.
 *
 * OpenFreeMap serves OpenStreetMap-derived vector tiles with no account and no
 * API key, which keeps one more credential out of the project. Both styles are
 * deliberately muted: the reports are the content, the map is the paper they
 * are printed on.
 *
 * Swapping to another provider means changing these two URLs.
 */

export const BASEMAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

export const BASEMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://openfreemap.org">OpenFreeMap</a>';

export type BasemapTheme = keyof typeof BASEMAP_STYLES;

export function basemapStyleFor(theme: BasemapTheme): string {
  return BASEMAP_STYLES[theme];
}
