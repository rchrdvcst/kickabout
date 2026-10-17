import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

/**
 * Escrita na API. Ao dar certo, marca todas as consultas como desatualizadas (o site é pequeno: simples e sempre correto).
 * Num 401 (sessão expirada), marca o usuário como deslogado; o `AdminLayout` leva para o login e volta para a mesma página.
 */
export function useApiMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn,
    onSuccess: () => client.invalidateQueries(),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) client.setQueryData(['me'], { user: null });
    },
  });
}
