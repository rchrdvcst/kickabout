import type { QueryClient } from '@tanstack/react-query';

/**
 * Fim da sessão (sair ou sessão expirada): apaga do cache tudo o que foi buscado logado — com
 * PHONE_VISIBILITY=authenticated isso inclui celulares — e marca o usuário como deslogado.
 */
export function forgetSession(client: QueryClient) {
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
  client.setQueryData(['me'], { user: null });
}
