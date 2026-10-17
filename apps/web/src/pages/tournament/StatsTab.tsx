import { Link } from 'react-router';
import { useTournamentStats } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { percent } from '../../lib/format';

export function StatsTab({ id }: { id: string }) {
  const stats = useTournamentStats(id);
  return (
    <QueryState
      query={stats}
      isEmpty={(rows) => rows.length === 0}
      empty={<p className="state">As estatísticas aparecem depois do primeiro resultado.</p>}
    >
      {(rows) => (
        <div className="table-wrap">
          <table aria-label="Artilharia">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" className="name">
                  Jogador
                </th>
                <th scope="col" className="name">
                  Time
                </th>
                <th scope="col">Gols</th>
                <th scope="col">Duelos</th>
                <th scope="col">Vitórias</th>
                <th scope="col">Aprov.</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, index) => (
                <tr key={row.playerId}>
                  <td>{index + 1}</td>
                  <td className="name">
                    <Link to={`/jogadores/${row.player.id}`}>{row.player.name}</Link>
                  </td>
                  <td className="name muted">{row.team?.name ?? ''}</td>
                  <td>
                    <strong>{row.goalsFor}</strong>
                  </td>
                  <td>{row.duels}</td>
                  <td>{row.wins}</td>
                  <td>{percent(row.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </QueryState>
  );
}
