import { Link, useParams } from 'react-router';
import { useFixture, useTournament } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { NotFoundPage } from '../NotFoundPage';
import { ResultForm } from './ResultForm';

export function AdminFixturePage() {
  const { id = '', matchId = '' } = useParams();
  const valid = /^\d+$/.test(matchId);
  const fixture = useFixture(id, Number(matchId), valid);
  const tournament = useTournament(id);

  if (!valid) return <NotFoundPage />;

  return (
    <QueryState query={fixture}>
      {(f) => (
        <QueryState query={tournament}>
          {(t) => (
            <>
              <p className="hero-context">
                <Link to={`/admin/campeonatos/${id}`}>{t.name}</Link>
              </p>
              <h1>
                {f.status === 'completed' ? 'Corrigir resultado' : 'Lançar resultado'}
                <span className="visually-hidden">
                  : {f.teamA.name} contra {f.teamB.name}
                </span>
              </h1>
              {t.status !== 'in_progress' ? (
                <p className="notice">Só é possível lançar resultados com o campeonato em andamento.</p>
              ) : f.rosterA && f.rosterB ? (
                <ResultForm key={`${id}:${f.matchId}`} tournamentId={id} fixture={f} rosterA={f.rosterA} rosterB={f.rosterB} />
              ) : (
                <p className="state">Carregando elencos…</p>
              )}
            </>
          )}
        </QueryState>
      )}
    </QueryState>
  );
}
