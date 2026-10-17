import type { TeamRef } from '../api/types';
import { TeamBadge } from './TeamBadge';

interface Props {
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
}

export function Scoreboard({ teamA, teamB, scoreA, scoreB }: Props) {
  return (
    <div className="scoreboard">
      <div className="scoreboard-team">
        <TeamBadge team={teamA} size="lg" />
        <span className="scoreboard-name">{teamA.name}</span>
      </div>
      <div className="scoreboard-score">
        {scoreA === null || scoreB === null ? (
          <span className="muted">vs</span>
        ) : (
          <>
            <span className={scoreA > scoreB ? 'scoreboard-winner' : undefined}>{scoreA}</span>
            <span className="scoreboard-sep" aria-hidden="true">
              ×
            </span>
            <span className="visually-hidden"> a </span>
            <span className={scoreB > scoreA ? 'scoreboard-winner' : undefined}>{scoreB}</span>
          </>
        )}
      </div>
      <div className="scoreboard-team">
        <TeamBadge team={teamB} size="lg" />
        <span className="scoreboard-name">{teamB.name}</span>
      </div>
    </div>
  );
}
