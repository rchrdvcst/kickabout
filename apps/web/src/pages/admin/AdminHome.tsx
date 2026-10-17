import { Link } from 'react-router';

const SECTIONS = [
  { to: '/admin/campeonatos', label: 'Campeonatos', hint: 'Criar, inscrever times, iniciar e lançar resultados' },
  { to: '/admin/times', label: 'Times', hint: 'Cadastro e elenco (BID)' },
  { to: '/admin/jogadores', label: 'Jogadores', hint: 'Nome, celular e transferências' },
  { to: '/admin/titulos', label: 'Títulos', hint: 'Histórico anterior ao Kickabout' },
];

export function AdminHome() {
  return (
    <section>
      <h1>Área do organizador</h1>
      <ul className="list">
        {SECTIONS.map((section) => (
          <li key={section.to}>
            <Link to={section.to} className="row-link">
              <span className="row-title">{section.label}</span>
              <span className="row-meta">{section.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
