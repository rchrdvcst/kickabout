import { Link } from 'react-router';
import type { StandingRow } from '../api/types';
import { TeamBadge } from './TeamBadge';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function StandingsTable({ rows, label = 'Classificação' }: { rows: StandingRow[]; label?: string }) {
  return (
    <div className="table-wrap">
      <table aria-label={label}>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" className="name">
              Time
            </th>
            <th scope="col" title="Pontos">
              P
            </th>
            <th scope="col" title="Confrontos jogados">
              J
            </th>
            <th scope="col" title="Vitórias">
              V
            </th>
            <th scope="col" title="Empates">
              E
            </th>
            <th scope="col" title="Saldo de gols">
              SG
            </th>
            <th scope="col" title="Duelos vencidos e perdidos">
              Duelos
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId} className={row.qualified ? 'qualified' : undefined}>
              <td>{row.position}</td>
              <td className="name">
                <Link to={`/times/${row.team.id}`}>
                  <TeamBadge team={row.team} />
                  {row.team.name}
                </Link>
              </td>
              <td>
                <strong>{row.points}</strong>
              </td>
              <td>{row.played}</td>
              <td>{row.wins}</td>
              <td>{row.draws}</td>
              <td>{signed(row.goalDiff)}</td>
              <td className="muted">
                {row.duelsWon}–{row.duelsLost}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
