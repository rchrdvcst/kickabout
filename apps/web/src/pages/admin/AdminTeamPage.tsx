import { Link, useParams } from 'react-router';
import { useRoster } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { TeamBadge } from '../../components/TeamBadge';
import { RosterManager } from './team/RosterManager';
import { TeamEditForm } from './team/TeamEditForm';

export function AdminTeamPage() {
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
          <p>
            <Link to={`/times/${team.id}`}>Ver página pública</Link>
          </p>
          <TeamEditForm key={team.id} team={team} />
          <RosterManager teamId={team.id} players={players} />
        </>
      )}
    </QueryState>
  );
}
