import { Link, useParams } from 'react-router';
import { usePlayer } from '../api/queries';
import { QueryState } from '../components/QueryState';
import { formatDate, percent, positionLabel } from '../lib/format';

const RESULT = {
  win: { label: 'V', title: 'Vitória', className: 'chip chip-win' },
  draw: { label: 'E', title: 'Empate', className: 'chip' },
  loss: { label: 'D', title: 'Derrota', className: 'chip chip-loss' },
} as const;

export function PlayerPage() {
  const { id = '' } = useParams();
  const player = usePlayer(id);

  return (
    <QueryState query={player}>
      {(data) => (
        <>
          <header className="page-header">
            <h1>{data.player.name}</h1>
            <p className="muted">
              {data.currentTeam ? <Link to={`/times/${data.currentTeam.id}`}>{data.currentTeam.name}</Link> : 'Sem time no momento'}
            </p>
          </header>

          <div className="stat-grid">
            <div className="stat">
              <span className="stat-value">{data.stats.duels}</span>
              <span className="stat-label">Duelos</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {data.stats.wins}-{data.stats.draws}-{data.stats.losses}
              </span>
              <span className="stat-label">V-E-D</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {data.stats.goalsFor}/{data.stats.goalsAgainst}
              </span>
              <span className="stat-label">Gols marcados/sofridos</span>
            </div>
            <div className="stat">
              <span className="stat-value">{percent(data.stats.winRate)}</span>
              <span className="stat-label">Aproveitamento</span>
            </div>
          </div>

          <h2>Duelos</h2>
          {data.duels.length === 0 ? (
            <p className="muted">Nenhum duelo jogado ainda.</p>
          ) : (
            <ul className="list" aria-label="Histórico de duelos">
              {data.duels.map((duel) => {
                const result = RESULT[duel.result];
                const round = duel.order === 6 ? 'desempate' : `${duel.order}º duelo`;
                return (
                  <li key={`${duel.tournamentId}-${duel.matchId}-${duel.order}`} className="row-link">
                    <span className={result.className} title={result.title}>
                      {result.label}
                    </span>
                    <span className="row-title">
                      {duel.goalsFor} × {duel.goalsAgainst}
                      {duel.penaltiesFor !== null && duel.penaltiesAgainst !== null && (
                        <> ({duel.penaltiesFor} × {duel.penaltiesAgainst} nos pênaltis)</>
                      )}{' '}
                      <span className="muted">
                        contra {duel.opponent.name} ({duel.opponentTeam.name})
                      </span>
                    </span>
                    <Link to={`/campeonatos/${duel.tournamentId}/jogos/${duel.matchId}`} className="row-meta">
                      {duel.tournamentName}, {round}
                      {duel.playedAt && <>, {formatDate(duel.playedAt)}</>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {data.titles.length > 0 && (
            <>
              <h2>Títulos</h2>
              <ul className="list">
                {data.titles.map((title) => (
                  <li key={`${title.tournamentId}-${title.position}`} className="row-link">
                    <span className={title.position === 1 ? 'chip chip-win' : 'chip'}>{positionLabel(title.position)}</span>
                    <span className="row-title">{title.tournamentName}</span>
                    <span className="row-meta">
                      {title.team.name}, {title.year}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2>Times</h2>
          <ul className="list">
            {data.teamHistory.map((entry) => (
              <li key={`${entry.team.id}-${entry.joinedAt}`} className="row-link">
                <Link to={`/times/${entry.team.id}`} className="row-title">
                  {entry.team.name}
                </Link>
                <span className="row-meta">
                  {formatDate(entry.joinedAt)} até {entry.leftAt ? formatDate(entry.leftAt) : 'hoje'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </QueryState>
  );
}
