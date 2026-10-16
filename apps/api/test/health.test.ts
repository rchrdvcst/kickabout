import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers';

const app = createTestApp();
afterAll(() => app.close());

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
