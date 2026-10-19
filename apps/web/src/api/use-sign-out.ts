import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { logout } from './admin';
import { forgetSession } from './session';

/** Sair: encerra a sessão na API, esquece os dados logados e volta para o início. */
export function useSignOut() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      forgetSession(client);
      navigate('/');
    },
  });
}
