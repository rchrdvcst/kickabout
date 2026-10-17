import { Link, useParams } from 'react-router';
import { useFixture, useTournament } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { ResultForm } from './ResultForm';

export function AdminFixturePage() {
  const { id = '', matchId = '' } = useParams();
  const fixture = useFixture(id, Number(matchId));
  const tournament = useTournament(id);

  return (
    <QueryState query={fixture}>
      {(f) => (
        <>
          <p className="hero-context">
            <Link to={`/admin/campeonatos/${id}`}>{tournament.data?.name ?? 'Campeonato'}</Link>
          </p>
          <h1>
            {f.teamA.name} contra {f.teamB.name}
          </h1>
          {tournament.data && tournament.data.status !== 'in_progress' ? (
            <p className="notice">Só é possível lançar resultados com o campeonato em andamento.</p>
          ) : f.rosterA && f.rosterB ? (
            <ResultForm key={f.matchId} tournamentId={id} fixture={f} rosterA={f.rosterA} rosterB={f.rosterB} />
          ) : (
            <p className="state">Carregando elencos…</p>
          )}
        </>
      )}
    </QueryState>
  );
}
