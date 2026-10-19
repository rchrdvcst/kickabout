import { useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleIdentity {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let loading: Promise<void> | null = null;

/** Carrega o script do Google uma vez; se falhar, a próxima tentativa carrega de novo. */
function loadGoogle(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      loading = null;
      script.remove();
      reject(new Error('Script do Google não carregou.'));
    });
    document.head.append(script);
  });
  return loading;
}

/** Botão oficial "Fazer login com o Google" (Google Identity Services). Entrega o ID token em `onCredential`. */
export function GoogleButton({ clientId, onCredential }: { clientId: string; onCredential: (credential: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let active = true;
    loadGoogle().then(
      () => {
        const google = window.google;
        if (!active || !container.current || !google) return;
        google.accounts.id.initialize({ client_id: clientId, callback: (response) => callback.current(response.credential) });
        google.accounts.id.renderButton(container.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'pt-BR',
        });
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [clientId]);

  if (failed) {
    return (
      <p className="state state-error" role="alert">
        Não foi possível carregar o login do Google. Use email e senha ou tente de novo.
      </p>
    );
  }
  return <div ref={container} className="google-button" />;
}
