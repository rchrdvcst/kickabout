import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { logout } from '../../api/admin';
import { useMe } from '../../api/queries';
import { forgetSession } from '../../api/session';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';

/** Tudo em /admin exige login; sem sessão, vai para /entrar e volta para cá depois. */
export function AdminLayout() {
  const me = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const exit = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      forgetSession(client);
      navigate('/');
    },
  });

  return (
    <QueryState query={me}>
      {({ user }) =>
        user ? (
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
              </nav>
              <button type="button" className="admin-exit" disabled={exit.isPending} onClick={() => exit.mutate()}>
                Sair
              </button>
            </div>
            <FormError error={exit.error} />
            <Outlet />
          </>
        ) : exit.isPending || exit.isSuccess ? null : (
          // Saindo por vontade própria: vai para o início, não para o login.
          <Navigate to={`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`} replace />
        )
      }
    </QueryState>
  );
}
