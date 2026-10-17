import { Link, NavLink, Outlet, useLocation } from 'react-router';

export function Layout() {
  // Na área do organizador, a barra dele (AdminLayout) substitui o menu público.
  const inAdmin = /^\/admin(\/|$)/.test(useLocation().pathname);

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
          <nav aria-label="Principal" className="mainnav">
            <NavLink to="/campeonatos">Campeonatos</NavLink>
            <NavLink to="/times">Times</NavLink>
            <NavLink to="/titulos">Títulos</NavLink>
          </nav>
        )}
      </header>
      <main className="page">
        <Outlet />
      </main>
      {!inAdmin && (
        <footer className="footer">
          <Link to="/admin">Área do organizador</Link>
        </footer>
      )}
    </div>
  );
}
