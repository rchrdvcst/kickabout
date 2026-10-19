import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../../api/queries';
import { useSignOut } from '../../api/use-sign-out';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { NotFoundPage } from '../NotFoundPage';

/**
 * Tudo em /admin exige um organizador. Sem sessão, vai para /entrar e volta para cá depois.
 * Usuário comum vê a página de "não encontrada", como em qualquer endereço que não existe.
 */
export function AdminLayout() {
  const me = useMe();
  const location = useLocation();
  const exit = useSignOut();

  return (
    <QueryState query={me}>
      {({ user }) =>
        user?.role === 'admin' ? (
          <>
            <div className="admin-bar">
              <nav aria-label="Administração" className="admin-nav">
                <NavLink to="/admin" end className="admin-home">
                  Organizador
                </NavLink>
                <NavLink to="/admin/campeonatos">Campeonatos</NavLink>
                <NavLink to="/admin/times">Times</NavLink>
                <NavLink to="/admin/jogadores">Jogadores</NavLink>
                <NavLink to="/admin/titulos">Títulos</NavLink>
                <NavLink to="/admin/usuarios">Usuários</NavLink>
              </nav>
              <button type="button" className="admin-exit" disabled={exit.isPending} onClick={() => exit.mutate()}>
                Sair
              </button>
            </div>
            <FormError error={exit.error} />
            <Outlet />
          </>
        ) : user ? (
          <NotFoundPage />
        ) : exit.isPending || exit.isSuccess ? null : (
          // Saindo por vontade própria: vai para o início, não para o login.
          <Navigate to={`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`} replace />
        )
      }
    </QueryState>
  );
}
