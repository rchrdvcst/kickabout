import type { CountryCode } from 'libphonenumber-js';
import { useEffect, useId, useRef, useState } from 'react';
import {
  countryName,
  countryOptions,
  isPossibleFor,
  maskNational,
  parseInternational,
  splitInternational,
  toInternational,
} from '../lib/phone';

interface Props {
  label: string;
  /** Número no formato internacional (+5584996773612), ou '' vazio. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

/** País (bandeira + código) e número com a máscara do país. Entrega sempre o número internacional. */
export function PhoneField({ label, value, onChange, required }: Props) {
  const [initial] = useState(() => splitInternational(value));
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();

  // O formulário limpou o valor (depois de cadastrar): limpa o campo também.
  useEffect(() => {
    if (value === '') {
      setNational('');
      setTouched(false);
    }
  }, [value]);

  const invalid = touched && national !== '' && !isPossibleFor(country, national);
  const message = invalid ? `Número inválido para ${countryName(country)}.` : '';
  useEffect(() => {
    input.current?.setCustomValidity(message);
  }, [message]);

  const update = (nextCountry: CountryCode, text: string) => {
    const pasted = parseInternational(text);
    const target = pasted?.country ?? nextCountry;
    const masked = pasted ? pasted.national : maskNational(target, text);
    setCountry(target);
    setNational(masked);
    onChange(toInternational(target, masked));
  };

  return (
    <div className="field">
      <label htmlFor={`${hintId}-number`}>
        <span>{label}</span>
      </label>
      <div className="phone-field">
        <select aria-label="País do celular" value={country} onChange={(e) => update(e.target.value as CountryCode, national)}>
          {countryOptions().map((option) => (
            <option key={option.code} value={option.code}>
              {option.flag} {option.name} +{option.dial}
            </option>
          ))}
        </select>
        <input
          ref={input}
          id={`${hintId}-number`}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          aria-describedby={invalid ? hintId : undefined}
          value={national}
          onChange={(e) => update(country, e.target.value)}
          onBlur={() => setTouched(true)}
        />
      </div>
      {invalid && (
        <p id={hintId} className="field-error">
          {message}
        </p>
      )}
    </div>
  );
}
