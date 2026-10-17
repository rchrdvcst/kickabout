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
        // Sessão expirada numa página do admin que só lê: vai para o login, como numa escrita.
        if (error instanceof ApiError && error.status === 401 && query.queryKey[0] !== 'me') forgetSession(client);
      },
    }),
    defaultOptions: { queries: { staleTime, retry: retry ? shouldRetry : false } },
  });
  return client;
}
