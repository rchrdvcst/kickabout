import { Link, useParams } from 'react-router';
import { useTeam } from '../api/queries';
import type { RecordTally } from '../api/types';
import { MatchRow } from '../components/MatchRow';
import { QueryState } from '../components/QueryState';
import { RosterList } from '../components/RosterList';
import { TeamBadge } from '../components/TeamBadge';
import { STATUS_LABEL, positionLabel } from '../lib/format';

const record = (tally: RecordTally) => `${tally.wins}-${tally.draws}-${tally.losses}`;

export function TeamPage() {
  const { id = '' } = useParams();
  const team = useTeam(id);

  return (
    <QueryState query={team}>
      {(data) => (
        <>
          <header className="team-header">
            <TeamBadge team={data.team} size="lg" />
            <h1>{data.team.name}</h1>
          </header>
          <Link to={`/times/${data.team.id}/bid`} className="button-link">
            Ver BID
          </Link>

          <h2>Números</h2>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-value">{record(data.stats.fixtures)}</span>
              <span className="stat-label">Confrontos (V-E-D)</span>
            </div>
            <div className="stat">
              <span className="stat-value">{record(data.stats.duels)}</span>
              <span className="stat-label">Duelos (V-E-D)</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {data.stats.goalsFor}/{data.stats.goalsAgainst}
              </span>
              <span className="stat-label">Gols marcados/sofridos</span>
            </div>
          </div>

          <h2>Títulos</h2>
          {data.titles.length === 0 ? (
            <p className="muted">Nenhum título ainda.</p>
          ) : (
            <ul className="list">
              {data.titles.map((title) => (
                <li key={title.id} className="row-link">
                  <span className={title.position === 1 ? 'chip chip-win' : 'chip'}>{positionLabel(title.position)}</span>
                  <span className="row-title">{title.tournamentName}</span>
                  <span className="row-meta">{title.year}</span>
                </li>
              ))}
            </ul>
          )}

          <h2>Últimos confrontos</h2>
          {data.recentFixtures.length === 0 ? (
            <p className="muted">Nenhum confronto jogado ainda.</p>
          ) : (
            <ul className="list">
              {data.recentFixtures.map((fixture) => (
                <li key={`${fixture.tournamentId}-${fixture.matchId}`}>
                  <MatchRow
                    to={`/campeonatos/${fixture.tournamentId}/jogos/${fixture.matchId}`}
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
          )}

          <h2>Elenco</h2>
          <RosterList players={data.roster} />

          {data.tournaments.length > 0 && (
            <>
              <h2>Campeonatos</h2>
              <ul className="list">
                {data.tournaments.map((tournament) => (
                  <li key={tournament.id}>
                    <Link to={`/campeonatos/${tournament.id}`} className="row-link">
                      <span className="row-title">{tournament.name}</span>
                      <span className="row-meta">{STATUS_LABEL[tournament.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </QueryState>
  );
}
