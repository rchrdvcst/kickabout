const BRAZIL_COUNTRY_CODE = '55';

/** Número nacional brasileiro (DDD + assinante), sem zeros de prefixo. */
function brazilian(national: string): string | null {
  const digits = national.replace(/^0+/, '');
  return digits.length === 10 || digits.length === 11 ? `+${BRAZIL_COUNTRY_CODE}${digits}` : null;
}

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    if (digits.startsWith(BRAZIL_COUNTRY_CODE)) return brazilian(digits.slice(BRAZIL_COUNTRY_CODE.length));
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  digits = digits.replace(/^0+/, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith(BRAZIL_COUNTRY_CODE)) {
    return brazilian(digits.slice(BRAZIL_COUNTRY_CODE.length));
  }
  return brazilian(digits);
}

export function whatsappUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}`;
}
