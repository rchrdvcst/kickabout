import { describe, expect, it } from 'vitest';
import { ApiError, apiGet } from '../src/api/client';
import { mockApi } from './utils';

describe('apiGet', () => {
  it('returns the parsed body', async () => {
    mockApi({ '/health': { ok: true } });
    await expect(apiGet('/health')).resolves.toEqual({ ok: true });
  });

  it('turns the error envelope into an ApiError with the Portuguese message', async () => {
    mockApi({});
    const error = await apiGet('/nao-existe').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Rota não encontrada.' });
  });

  it('handles a non-JSON gateway error', async () => {
    mockApi({ '/health': new Response('<html>Bad Gateway</html>', { status: 502 }) });
    await expect(apiGet('/health')).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
      message: 'Não foi possível falar com o servidor. Tente de novo em instantes.',
    });
  });

  it('rejects a successful response whose body is not JSON (SPA fallback answering /api)', async () => {
    mockApi({ '/health': new Response('<!doctype html><html></html>', { status: 200 }) });
    await expect(apiGet('/health')).rejects.toMatchObject({
      status: 200,
      code: 'BAD_RESPONSE',
      message: 'Não foi possível falar com o servidor. Tente de novo em instantes.',
    });
  });
});
