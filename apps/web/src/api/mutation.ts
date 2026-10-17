import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from './client';
import { forgetSession } from './session';

/**
 * Escrita na API. Ao terminar (com sucesso ou erro), marca todas as consultas como desatualizadas: uma edição em
 * duas etapas pode ter salvo a primeira. Num 401 (sessão expirada), esquece a sessão; o `AdminLayout` leva para o login.
 */
export function useApiMutation<TVars, TResult>(mutationFn: (vars: TVars) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn,
    onSettled: (_data, error) => {
      if (error instanceof ApiError && error.status === 401) return forgetSession(client);
      return client.invalidateQueries();
    },
  });
}
