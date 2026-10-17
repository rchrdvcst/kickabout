import { Link } from 'react-router';
import type { TournamentListItem } from '../api/types';
import { FORMAT_LABEL } from '../lib/format';

export function TournamentList({ items }: { items: TournamentListItem[] }) {
  return (
    <ul className="list">
      {items.map((tournament) => (
        <li key={tournament.id}>
          <Link to={`/campeonatos/${tournament.id}`} className="row-link">
            <span className="row-title">{tournament.name}</span>
            <span className="row-meta">
              {FORMAT_LABEL[tournament.format]}, {tournament.teamCount} times
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
