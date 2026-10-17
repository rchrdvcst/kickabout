import { Link } from 'react-router';
import { useRecentFixtures, useTournaments } from '../api/queries';
import { MatchRow } from '../components/MatchRow';
import { QueryState } from '../components/QueryState';
import { Scoreboard } from '../components/Scoreboard';
import { TournamentList } from '../components/TournamentList';

const fixtureUrl = (tournamentId: string, matchId: number) => `/campeonatos/${tournamentId}/jogos/${matchId}`;

export function HomePage() {
  const recent = useRecentFixtures(8);
  const live = useTournaments('in_progress');

  return (
    <>
      <h1 className="visually-hidden">Kickabout</h1>
      <QueryState
        query={recent}
        isEmpty={(fixtures) => fixtures.length === 0}
        empty={
          <section className="hero">
            <h2>Nenhum resultado ainda</h2>
            <p className="muted">Os confrontos aparecem aqui assim que o primeiro resultado for lançado.</p>
            <Link to="/campeonatos" className="button-link">
              Ver campeonatos
            </Link>
          </section>
        }
      >
        {([latest, ...rest]) => (
          <>
            {latest && (
              <section className="hero">
                <p className="hero-context">
                  <Link to={`/campeonatos/${latest.tournamentId}`}>{latest.tournamentName}</Link>
                </p>
                <Link to={fixtureUrl(latest.tournamentId, latest.matchId)} className="hero-link">
                  <Scoreboard teamA={latest.teamA} teamB={latest.teamB} scoreA={latest.scoreA} scoreB={latest.scoreB} />
                </Link>
              </section>
            )}
            {rest.length > 0 && (
              <section>
                <h2>Resultados recentes</h2>
                <ul className="list">
                  {rest.map((fixture) => (
                    <li key={`${fixture.tournamentId}-${fixture.matchId}`}>
                      <MatchRow
                        to={fixtureUrl(fixture.tournamentId, fixture.matchId)}
                        teamA={fixture.teamA}
                        teamB={fixture.teamB}
                        scoreA={fixture.scoreA}
                        scoreB={fixture.scoreB}
                        status="completed"
                        caption={fixture.tournamentName}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </QueryState>

      <section>
        <h2>Em andamento</h2>
        <QueryState
          query={live}
          isEmpty={(list) => list.length === 0}
          empty={<p className="muted">Nenhum campeonato em andamento.</p>}
        >
          {(list) => <TournamentList items={list} />}
        </QueryState>
      </section>

      <p>
        <Link to="/titulos">Ver campeões e ranking de títulos</Link>
      </p>
    </>
  );
}
