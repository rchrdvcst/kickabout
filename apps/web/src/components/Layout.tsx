import { Link, NavLink, Outlet } from 'react-router';

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="Kickabout, início">
          <img src="/logo.png" alt="" width={60} height={40} />
        </Link>
        <nav aria-label="Principal" className="mainnav">
          <NavLink to="/campeonatos">Campeonatos</NavLink>
          <NavLink to="/times">Times</NavLink>
          <NavLink to="/titulos">Títulos</NavLink>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">
        <Link to="/admin">Área do organizador</Link>
      </footer>
    </div>
  );
}
