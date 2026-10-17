import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section>
      <h1>Página não encontrada</h1>
      <p className="muted">Confira o endereço ou volte para o início.</p>
      <Link to="/" className="button-link">
        Voltar para o início
      </Link>
    </section>
  );
}
