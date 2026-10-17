import { Link } from 'react-router';
import type { FixtureStatus, TeamRef } from '../api/types';
import { StatusChip } from './StatusChip';
import { TeamBadge } from './TeamBadge';

interface Props {
  to: string;
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
  status: FixtureStatus;
  caption?: string;
}

export function MatchRow({ to, teamA, teamB, scoreA, scoreB, status, caption }: Props) {
  return (
    <Link to={to} className="match-row">
      {caption && <span className="match-caption">{caption}</span>}
      <span className="match-team">
        <TeamBadge team={teamA} />
        {teamA.name}
      </span>
      <span className="match-score">
        {status === 'completed' && scoreA !== null && scoreB !== null ? (
          <>
            {scoreA}
            <span className="sep" aria-hidden="true">
              ×
            </span>
            <span className="visually-hidden"> a </span>
            {scoreB}
          </>
        ) : (
          <StatusChip status={status} />
        )}
      </span>
      <span className="match-team match-team-b">
        {teamB.name}
        <TeamBadge team={teamB} />
      </span>
    </Link>
  );
}
