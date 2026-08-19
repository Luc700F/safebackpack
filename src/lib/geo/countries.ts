/**
 * ISO 3166-1 alpha-2 country codes.
 *
 * Only the codes are stored. Display names come from the platform's own
 * localisation data, so they are always spelled correctly, always current, and
 * translate for free the day the interface gains a second language.
 */

const CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW';

export const COUNTRY_CODES: readonly string[] = Object.freeze(CODES.split(' '));

const CODE_SET = new Set(COUNTRY_CODES);

export function isCountryCode(value: unknown): boolean {
  return typeof value === 'string' && CODE_SET.has(value);
}

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** English name of a country, e.g. `CH` → `Switzerland`. */
export function countryName(code: string): string {
  if (!CODE_SET.has(code)) {
    throw new Error(`Unknown country code: ${code}`);
  }

  return displayNames.of(code) ?? code;
}

export interface CountryOption {
  code: string;
  name: string;
}

/** Every country, sorted by name, ready for a select element. */
export function countryOptions(): CountryOption[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort(
    (a, b) => a.name.localeCompare(b.name, 'en'),
  );
}
