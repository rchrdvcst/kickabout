import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { routes } from '../src/router';

export type ApiRoutes = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Simula a API: chave = caminho sem `/api` (com query string tem prioridade sobre sem). */
export function mockApi(routes: ApiRoutes) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    const path = url.pathname.replace(/^\/api/, '');
    const handler = routes[path + url.search] ?? routes[path];
    if (handler === undefined) return json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }, 404);
    if (handler instanceof Response) return handler;
    return json(handler);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function renderRoute(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
