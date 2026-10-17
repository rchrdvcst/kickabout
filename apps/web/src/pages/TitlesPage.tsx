import { Link } from 'react-router';
import { useTitles } from '../api/queries';
import type { TitleEntry } from '../api/types';
import { QueryState } from '../components/QueryState';
import { TeamBadge } from '../components/TeamBadge';
import { positionLabel } from '../lib/format';

function groupByTournament(titles: TitleEntry[]) {
  const groups = new Map<string, TitleEntry[]>();
  for (const title of titles) {
    const key = `${title.tournamentId ?? title.tournamentName}-${title.year}`;
    groups.set(key, [...(groups.get(key) ?? []), title]);
  }
  return [...groups.values()].map((entries) => entries.sort((a, b) => a.position - b.position));
}

export function TitlesPage() {
  const titles = useTitles();
  return (
    <>
      <h1>Títulos</h1>
      <QueryState
        query={titles}
        isEmpty={(data) => data.titles.length === 0}
        empty={<p className="state">Os títulos aparecem quando o primeiro campeonato for encerrado.</p>}
      >
        {(data) => (
          <>
            <div className="table-wrap">
              <table aria-label="Ranking de títulos">
                <thead>
                  <tr>
                    <th scope="col" className="name">
                      Time
                    </th>
                    <th scope="col">Campeão</th>
                    <th scope="col">Vice</th>
                    <th scope="col">3º</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranking.map((row) => (
                    <tr key={row.team.id}>
                      <td className="name">
                        <Link to={`/times/${row.team.id}`}>
                          <TeamBadge team={row.team} />
                          {row.team.name}
                        </Link>
                      </td>
                      <td>
                        <strong>{row.champion}</strong>
                      </td>
                      <td>{row.runnerUp}</td>
                      <td>{row.third}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {groupByTournament(data.titles).map((podium) => {
              const first = podium[0]!;
              return (
                <section key={first.id}>
                  <h2>
                    {first.tournamentName} ({first.year})
                  </h2>
                  <ul className="list">
                    {podium.map((title) => (
                      <li key={title.id}>
                        <Link to={`/times/${title.team.id}`} className="row-link">
                          <span className={title.position === 1 ? 'chip chip-win' : 'chip'}>{positionLabel(title.position)}</span>
                          <TeamBadge team={title.team} />
                          <span className="row-title">{title.team.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </QueryState>
    </>
  );
}
