import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isPossiblePhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export const DEFAULT_COUNTRY: CountryCode = 'BR';

export interface CountryOption {
  code: CountryCode;
  dial: string;
  name: string;
  flag: string;
}

const flagOf = (code: string) => String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));

/** Países mais prováveis entre os jogadores: ficam no topo da lista, nesta ordem. */
export const COMMON_COUNTRIES: CountryCode[] = ['BR', 'PT', 'AR', 'UY', 'PY', 'US'];

let cache: { common: CountryOption[]; others: CountryOption[] } | null = null;

/** Países com código de discagem e nome em português: os mais usados primeiro, os demais em ordem alfabética, sem repetir. */
export function countryGroups(): { common: CountryOption[]; others: CountryOption[] } {
  if (cache) return cache;
  const names = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
  const all = getCountries().map((code) => ({ code, dial: getCountryCallingCode(code), name: names.of(code) ?? code, flag: flagOf(code) }));
  all.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  cache = {
    common: COMMON_COUNTRIES.map((code) => all.find((option) => option.code === code)!),
    others: all.filter((option) => !COMMON_COUNTRIES.includes(option.code)),
  };
  return cache;
}

export function countryName(code: CountryCode): string {
  const { common, others } = countryGroups();
  return [...common, ...others].find((option) => option.code === code)?.name ?? code;
}

/**
 * Brasil: (DD) XXXX-XXXX até 10 dígitos e (DD) XXXXX-XXXX com 11. A biblioteca trata (84) 9677-3612
 * como celular incompleto e quebraria a máscara; aqui os dois tamanhos valem.
 */
function maskBrazil(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = d.length <= 10 ? 4 : 5;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** Máscara do país enquanto se digita (só o número nacional, sem o código do país). */
export function maskNational(country: CountryCode, text: string): string {
  const digits = text.replace(/\D/g, '');
  if (!digits) return '';
  return country === 'BR' ? maskBrazil(digits) : new AsYouType(country).input(digits);
}

/** Número completo no formato internacional (+5584996773612), ou '' sem dígitos. */
export function toInternational(country: CountryCode, national: string): string {
  const digits = national.replace(/\D/g, '');
  return digits ? `+${getCountryCallingCode(country)}${digits}` : '';
}

/**
 * Comprimento possível para o país. Não exige número "válido" pelas regras atuais: celulares brasileiros
 * antigos, com 8 dígitos depois do DDD (+55 84 9677-3612), continuam aceitos.
 */
export const isPossibleFor = (country: CountryCode, national: string) => isPossiblePhoneNumber(national.replace(/\D/g, ''), country);

/** Texto colado com + e código do país: descobre o país e o número nacional. */
export function parseInternational(text: string): { country: CountryCode; national: string } | null {
  if (!text.trim().startsWith('+')) return null;
  const typed = new AsYouType();
  typed.input(text);
  const country = typed.getCountry();
  const parsed = parsePhoneNumberFromString(text);
  if (!country || !parsed) return null;
  return { country, national: maskNational(country, parsed.nationalNumber) };
}

/** Número salvo (+351912345678) separado de volta em país e número nacional mascarado. */
export function splitInternational(value: string): { country: CountryCode; national: string } {
  return parseInternational(value) ?? { country: DEFAULT_COUNTRY, national: maskNational(DEFAULT_COUNTRY, value) };
}
