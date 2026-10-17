import { Link, useParams } from 'react-router';
import { useRoster } from '../api/queries';
import { QueryState } from '../components/QueryState';
import { RosterList } from '../components/RosterList';
import { TeamBadge } from '../components/TeamBadge';

export function TeamBidPage() {
  const { id = '' } = useParams();
  const roster = useRoster(id);

  return (
    <QueryState query={roster}>
      {({ team, players }) => (
        <>
          <header className="team-header">
            <TeamBadge team={team} size="lg" />
            <h1>{team.name}</h1>
          </header>
          <p className="muted">
            {players.length > 0 && <span>BID com {players.length} {players.length === 1 ? 'jogador' : 'jogadores'}. </span>}
            <Link to={`/times/${team.id}`}>Ver página do time</Link>
          </p>
          <RosterList players={players} />
        </>
      )}
    </QueryState>
  );
}
