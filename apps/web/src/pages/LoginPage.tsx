import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { login } from '../api/admin';
import { useApiMutation } from '../api/mutation';
import { useMe } from '../api/queries';
import { FormError } from '../components/FormError';
import { safeRedirect } from '../lib/redirect';

export function LoginPage() {
  const [params] = useSearchParams();
  const target = safeRedirect(params.get('voltar'));
  const navigate = useNavigate();
  const me = useMe();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useApiMutation((vars: { email: string; password: string }) => login(vars.email, vars.password));

  if (me.data?.user) return <Navigate to={target} replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ email, password }, { onSuccess: () => navigate(target, { replace: true }) });
  };

  return (
    <section className="narrow">
      <h1>Entrar</h1>
      <p className="muted">Área do organizador: cadastro de times, jogadores, campeonatos e resultados.</p>
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
        <FormError error={mutation.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={mutation.isPending}>
            Entrar
          </button>
        </div>
      </form>
    </section>
  );
}
