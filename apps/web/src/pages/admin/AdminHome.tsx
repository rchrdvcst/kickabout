import { Link } from 'react-router';
import { ApiError } from '../../api/client';
import { useFixturesOf, useTournaments } from '../../api/queries';
import type { TournamentListItem } from '../../api/types';
import { MatchRow } from '../../components/MatchRow';
import { QueryState } from '../../components/QueryState';

const SECTIONS = [
  { to: '/admin/campeonatos', label: 'Campeonatos', hint: 'Criar, inscrever times, iniciar e lançar resultados' },
  { to: '/admin/times', label: 'Times', hint: 'Cadastro e elenco (BID)' },
  { to: '/admin/jogadores', label: 'Jogadores', hint: 'Nome, celular e transferências' },
  { to: '/admin/titulos', label: 'Títulos', hint: 'Histórico anterior ao Kickabout' },
];

/** Mesa do organizador: primeiro o que espera resultado, depois os cadastros. */
export function AdminHome() {
  const live = useTournaments('in_progress');

  return (
    <>
      <h1>Área do organizador</h1>
      <section aria-labelledby="desk-title" className="desk">
        <h2 id="desk-title">Para lançar</h2>
        <QueryState
          query={live}
          isEmpty={(list) => list.length === 0}
          empty={<p className="state">Nenhum confronto esperando resultado.</p>}
        >
          {(list) => <Waiting tournaments={list} />}
        </QueryState>
      </section>
      <section aria-labelledby="records-title">
        <h2 id="records-title">Cadastros</h2>
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
    </>
  );
}

function Waiting({ tournaments }: { tournaments: TournamentListItem[] }) {
  const results = useFixturesOf(tournaments.map((tournament) => tournament.id));
  const groups = tournaments.map((tournament, index) => ({
    tournament,
    waiting: (results[index]?.data ?? []).filter((fixture) => fixture.status !== 'completed'),
  }));
  const loaded = results.every((result) => result.data);
  const error = results.find((result) => result.error)?.error;
  if (error) {
    return (
      <p className="state state-error" role="alert">
        {error instanceof ApiError ? error.message : 'Não foi possível carregar os confrontos.'}
      </p>
    );
  }
  if (loaded && groups.every((group) => group.waiting.length === 0)) {
    return <p className="state">Nenhum confronto esperando resultado.</p>;
  }
  return groups
    .filter((group) => group.waiting.length > 0)
    .map(({ tournament, waiting }) => (
      <div key={tournament.id} className="desk-group">
        <h3>
          <Link to={`/admin/campeonatos/${tournament.id}`}>{tournament.name}</Link>
        </h3>
        <ul className="list">
          {waiting.map((fixture) => (
            <li key={fixture.matchId}>
              <MatchRow
                to={`/admin/campeonatos/${tournament.id}/jogos/${fixture.matchId}`}
                teamA={fixture.teamA}
                teamB={fixture.teamB}
                scoreA={fixture.scoreA}
                scoreB={fixture.scoreB}
                status={fixture.status}
              />
            </li>
          ))}
        </ul>
      </div>
    ));
}
