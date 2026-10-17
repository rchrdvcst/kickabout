import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../src/router';

/** Valor fixo, `Response` (devolvida como está) ou função que recebe o corpo JSON enviado. */
export type ApiRoutes = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Simula a API. Chave = `MÉTODO /caminho` (sem `/api`); para GET também vale só `/caminho`.
 * Com query string tem prioridade sobre sem.
 */
export function mockApi(routes: ApiRoutes) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api/, '');
    const keys = [`${method} ${path}${url.search}`, `${method} ${path}`];
    if (method === 'GET') keys.push(path + url.search, path);
    const key = keys.find((candidate) => routes[candidate] !== undefined);
    if (key === undefined) return json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }, 404);
    let handler = routes[key];
    if (typeof handler === 'function') {
      handler = (handler as (body: unknown) => unknown)(init?.body ? JSON.parse(String(init.body)) : undefined);
    }
    if (handler instanceof Response) return handler;
    return json(handler);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export type FetchMock = ReturnType<typeof mockApi>;

/** Corpos JSON enviados para `MÉTODO /caminho`, na ordem (sem corpo → `undefined`). */
export function sentBodies(fetchMock: FetchMock, key: string): unknown[] {
  const [method, path] = key.split(' ');
  return fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        (init?.method ?? 'GET').toUpperCase() === method && new URL(String(input), 'http://localhost').pathname === `/api${path}`,
    )
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined));
}

export function renderRoute(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}
