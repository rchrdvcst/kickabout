import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useMe } from '../api/queries';
import { AccountMenu } from './AccountMenu';

export function Layout() {
  const user = useMe().data?.user ?? null;
  // Na área do organizador, a barra dele (AdminLayout) substitui o menu público. Para quem não é organizador,
  // /admin é uma página inexistente qualquer, com o layout público.
  const inAdmin = /^\/admin(\/|$)/.test(useLocation().pathname) && user?.role === 'admin';

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="Kickabout, início">
          <img src="/logo.png" alt="" width={60} height={40} />
        </Link>
        {inAdmin ? (
          <Link to="/" className="topbar-exit">
            Ver site
          </Link>
        ) : (
          <>
            <nav aria-label="Principal" className="mainnav">
              <NavLink to="/campeonatos">Campeonatos</NavLink>
              <NavLink to="/times">Times</NavLink>
              <NavLink to="/titulos">Títulos</NavLink>
            </nav>
            {user && <AccountMenu user={user} />}
          </>
        )}
      </header>
      <main className="page">
        <Outlet />
      </main>
      {!inAdmin && !user && (
        <footer className="footer">
          <Link to="/entrar">Entrar</Link>
        </footer>
      )}
    </div>
  );
}
