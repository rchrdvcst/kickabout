import { Link } from 'react-router';
import { useTeams } from '../api/queries';
import { QueryState } from '../components/QueryState';
import { TeamBadge } from '../components/TeamBadge';

export function TeamsPage() {
  const teams = useTeams();
  return (
    <>
      <h1>Times</h1>
      <QueryState query={teams} isEmpty={(list) => list.length === 0} empty={<p className="state">Nenhum time cadastrado ainda.</p>}>
        {(list) => (
          <ul className="list">
            {list.map((team) => (
              <li key={team.id}>
                <Link to={`/times/${team.id}`} className="row-link">
                  <TeamBadge team={team} />
                  <span className="row-title">{team.name}</span>
                  <span className="row-meta">
                    {team.playerCount} {team.playerCount === 1 ? 'jogador' : 'jogadores'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </>
  );
}
