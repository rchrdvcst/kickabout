import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import type { AuthUser } from '../api/types';
import { useSignOut } from '../api/use-sign-out';

/** Conta no topo: foto (ou inicial) e primeiro nome; o menu tem "Área do organizador" só para organizador, e "Sair". */
export function AccountMenu({ user }: { user: AuthUser }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const signOut = useSignOut();
  const label = user.name ?? user.email;
  const firstName = label.split(/[\s@]/)[0];
  const close = () => menu.current?.removeAttribute('open');
  const { pathname } = useLocation();

  // O topo continua montado entre as páginas: ao navegar, o menu fecha.
  useEffect(close, [pathname]);

  return (
    <details ref={menu} className="account" aria-label={`Conta de ${label}`}>
      <summary>
        {user.avatarUrl ? (
          <img className="account-photo" src={user.avatarUrl} alt="" width={32} height={32} referrerPolicy="no-referrer" />
        ) : (
          <span className="account-photo account-initial" aria-hidden="true">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="account-name">{firstName}</span>
      </summary>
      <div className="account-menu">
        {user.role === 'admin' && (
          <Link to="/admin" onClick={close}>
            Área do organizador
          </Link>
        )}
        <button type="button" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          Sair
        </button>
      </div>
    </details>
  );
}
