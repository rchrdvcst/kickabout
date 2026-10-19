import { setUserRole } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useMe, useUsers } from '../../api/queries';
import type { Role, UserListItem } from '../../api/types';
import { ConfirmButton } from '../../components/ConfirmButton';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { formatDate } from '../../lib/format';

const signInMethod = (user: UserListItem) =>
  user.hasGoogle && user.hasPassword ? 'Google e senha' : user.hasGoogle ? 'Google' : 'Senha';

/** Organizadores promovem e rebaixam usuários. A API impede rebaixar a si mesmo e ficar sem organizador. */
export function AdminUsersPage() {
  const me = useMe().data?.user;
  const users = useUsers();
  const change = useApiMutation((vars: { id: string; role: Role }) => setUserRole(vars.id, vars.role));

  return (
    <>
      <h1>Usuários</h1>
      <p className="muted">Quem entra com o Google começa como usuário comum. Só organizadores acessam esta área.</p>
      <FormError error={change.error} />
      <QueryState query={users}>
        {(list) => (
          <ul aria-label="Usuários">
            {list.map((user) => {
              const label = user.name ?? user.email;
              return (
                <li key={user.id} className="admin-row">
                  {user.avatarUrl ? (
                    <img className="account-photo" src={user.avatarUrl} alt="" width={32} height={32} referrerPolicy="no-referrer" />
                  ) : (
                    <span className="account-photo account-initial" aria-hidden="true">
                      {label.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="row-title">
                    {user.name ?? 'Sem nome'}
                    <span className="muted"> {user.email}</span>
                  </span>
                  <span className="muted">{signInMethod(user)}</span>
                  <span className="muted">{user.lastLoginAt ? `Último acesso ${formatDate(user.lastLoginAt)}` : 'Nunca entrou'}</span>
                  <span className={user.role === 'admin' ? 'chip chip-win' : 'chip'}>
                    {user.role === 'admin' ? 'Organizador' : 'Usuário'}
                  </span>
                  {user.id === me?.id ? (
                    <span className="muted">Você</span>
                  ) : user.role === 'admin' ? (
                    <ConfirmButton
                      name={`Remover ${label} de organizador`}
                      label="Remover organizador"
                      confirmLabel="Confirmar: remover organizador"
                      danger
                      disabled={change.isPending}
                      onConfirm={() => change.mutate({ id: user.id, role: 'user' })}
                    />
                  ) : (
                    <ConfirmButton
                      name={`Tornar ${label} organizador`}
                      label="Tornar organizador"
                      confirmLabel="Confirmar: tornar organizador"
                      disabled={change.isPending}
                      onConfirm={() => change.mutate({ id: user.id, role: 'admin' })}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </QueryState>
    </>
  );
}
