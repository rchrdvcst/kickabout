import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig({ DATABASE_URL: 'postgresql://x' })).toEqual({
      port: 3333,
      databaseUrl: 'postgresql://x',
      phoneVisibility: 'public',
      sessionTtlDays: 30,
      secureCookies: false,
    });
  });

  it('reads overrides and enables secure cookies in production', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgresql://x',
      PORT: '4000',
      PHONE_VISIBILITY: 'authenticated',
      SESSION_TTL_DAYS: '7',
      NODE_ENV: 'production',
    });
    expect(config).toMatchObject({ port: 4000, phoneVisibility: 'authenticated', sessionTtlDays: 7, secureCookies: true });
  });

  it('rejects a missing database url and an invalid phone visibility', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL');
    expect(() => loadConfig({ DATABASE_URL: 'x', PHONE_VISIBILITY: 'todos' })).toThrow('PHONE_VISIBILITY');
  });
});
