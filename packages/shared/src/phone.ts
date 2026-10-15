const BRAZIL_COUNTRY_CODE = '55';

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  digits = digits.replace(/^0+/, '');
  if (digits.length === 10 || digits.length === 11) return `+${BRAZIL_COUNTRY_CODE}${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith(BRAZIL_COUNTRY_CODE)) return `+${digits}`;
  return null;
}

export function whatsappUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}`;
}
