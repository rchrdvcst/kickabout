import { Link } from 'react-router';
import type { Tournament } from '../../api/types';
import { TeamBadge } from '../../components/TeamBadge';

export function TeamsTab({ tournament }: { tournament: Tournament }) {
  if (tournament.entries.length === 0) return <p className="state">Nenhum time inscrito ainda.</p>;
  return (
    <ul className="list">
      {tournament.entries.map(({ team }) => (
        <li key={team.id}>
          <Link to={`/times/${team.id}/bid`} className="row-link">
            <TeamBadge team={team} />
            <span className="row-title">{team.name}</span>
            <span className="row-meta">Ver BID</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
