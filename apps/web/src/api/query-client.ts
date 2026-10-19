import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';
import { forgetSession } from './session';

/** Não repete erros do cliente (4xx): "não encontrado" aparece na hora. O resto tenta mais uma vez. */
export const shouldRetry = (failureCount: number, error: unknown): boolean =>
  !(error instanceof ApiError && error.status < 500) && failureCount < 1;

export function createQueryClient({ retry = true, staleTime = 30_000 }: { retry?: boolean; staleTime?: number } = {}) {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!(error instanceof ApiError) || query.queryKey[0] === 'me') return;
        // Sessão expirada numa página do admin que só lê: vai para o login, como numa escrita.
        if (error.status === 401) forgetSession(client);
        // Perdeu o papel de organizador: busca a sessão de novo e o admin some.
        if (error.status === 403) void client.invalidateQueries({ queryKey: ['me'] });
      },
    }),
    defaultOptions: { queries: { staleTime, retry: retry ? shouldRetry : false } },
  });
  return client;
}
