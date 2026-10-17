import { Link } from 'react-router';
import { useTournamentStats } from '../../api/queries';
import type { LeaderboardRow } from '../../api/types';
import { QueryState } from '../../components/QueryState';
import { percent } from '../../lib/format';

const MIN_DUELS_FOR_RATE = 3;
const TOP = 10;

function Leaderboard({ label, rows }: { label: string; rows: LeaderboardRow[] }) {
  return (
    <div className="table-wrap">
      <table aria-label={label}>
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
          {rows.map((row, index) => (
            <tr key={row.playerId}>
              <td>{index + 1}</td>
              <td className="name">
                <Link to={`/jogadores/${row.player.id}`}>{row.player.name}</Link>
              </td>
              <td className="name muted">{row.team?.name ?? ''}</td>
              <td>{row.goalsFor}</td>
              <td>{row.duels}</td>
              <td>{row.wins}</td>
              <td>{percent(row.winRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsTab({ id }: { id: string }) {
  const stats = useTournamentStats(id);
  return (
    <QueryState
      query={stats}
      isEmpty={(rows) => rows.length === 0}
      empty={<p className="state">As estatísticas aparecem depois do primeiro resultado.</p>}
    >
      {(rows) => {
        // A API já devolve a lista ordenada por gols (artilharia).
        const byWins = [...rows].sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
        const byRate = rows
          .filter((row) => row.duels >= MIN_DUELS_FOR_RATE)
          .sort((a, b) => b.winRate - a.winRate || b.duels - a.duels);
        return (
          <>
            <h2>Artilharia</h2>
            <Leaderboard label="Artilharia" rows={rows.slice(0, TOP)} />
            <h2>Mais vitórias em duelos</h2>
            <Leaderboard label="Mais vitórias em duelos" rows={byWins.slice(0, TOP)} />
            <h2>Melhor aproveitamento</h2>
            <p className="muted">Melhor aproveitamento considera jogadores com pelo menos {MIN_DUELS_FOR_RATE} duelos.</p>
            {byRate.length === 0 ? (
              <p className="state">Nenhum jogador com {MIN_DUELS_FOR_RATE} duelos ainda.</p>
            ) : (
              <Leaderboard label="Melhor aproveitamento" rows={byRate.slice(0, TOP)} />
            )}
          </>
        );
      }}
    </QueryState>
  );
}
