import { describe, expect, it } from 'vitest';
import { normalizePhone, whatsappUrl } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['(11) 98765-4321', '+5511987654321'],
    ['11 3456-7890', '+551134567890'],
    ['+55 11 98765-4321', '+5511987654321'],
    ['5511987654321', '+5511987654321'],
    ['011 98765-4321', '+5511987654321'],
    ['0055 11 98765-4321', '+5511987654321'],
    ['55 98765-4321', '+5555987654321'], // DDD 55 (RS), sem código do país
    ['+351 912 345 678', '+351912345678'],
    ['+55 (011) 98765-4321', '+5511987654321'], // zero do DDD após o +55
  ])('normalizes %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '   ', '12345', '+1', '123456789012345678', 'abc', '+55 123'])('rejects %j', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('whatsappUrl', () => {
  it('builds a wa.me link with digits only', () => {
    expect(whatsappUrl('+5511987654321')).toBe('https://wa.me/5511987654321');
  });
});
