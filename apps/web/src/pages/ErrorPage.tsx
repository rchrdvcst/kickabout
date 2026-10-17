import { Link } from 'react-router';

/** Erro inesperado ao montar uma página (ex.: resposta da API em formato diferente do esperado). */
export function ErrorPage() {
  return (
    <section>
      <h1>Algo deu errado</h1>
      <p className="muted">Não foi possível mostrar esta página. Tente de novo em instantes.</p>
      <Link to="/" className="button-link">
        Voltar para o início
      </Link>
    </section>
  );
}
