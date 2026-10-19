import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { login, loginWithGoogle } from '../api/admin';
import { useApiMutation } from '../api/mutation';
import { useAuthConfig, useMe } from '../api/queries';
import type { AuthUser } from '../api/types';
import { FormError } from '../components/FormError';
import { GoogleButton } from '../components/GoogleButton';
import { afterSignIn } from '../lib/redirect';

export function LoginPage() {
  const [params] = useSearchParams();
  const target = params.get('voltar');
  const navigate = useNavigate();
  const me = useMe();
  const config = useAuthConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const withPassword = useApiMutation((vars: { email: string; password: string }) => login(vars.email, vars.password));
  const withGoogle = useApiMutation(loginWithGoogle);
  const done = ({ user }: { user: AuthUser }) => navigate(afterSignIn(user, target), { replace: true });

  if (me.data?.user) return <Navigate to={afterSignIn(me.data.user, target)} replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    withPassword.mutate({ email, password }, { onSuccess: done });
  };

  const clientId = config.data?.googleClientId;

  return (
    <section className="narrow">
      <h1>Entrar</h1>
      {clientId && (
        <div className="signin-google">
          <FormError error={withGoogle.error} />
          <GoogleButton clientId={clientId} onCredential={(credential) => withGoogle.mutate(credential, { onSuccess: done })} />
          <p className="signin-or">ou</p>
        </div>
      )}
      <form className="form" aria-label="Entrar" onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <FormError error={withPassword.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={withPassword.isPending}>
            Entrar
          </button>
        </div>
      </form>
    </section>
  );
}
