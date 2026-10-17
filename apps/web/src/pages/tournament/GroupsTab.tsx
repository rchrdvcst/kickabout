import { useStandings } from '../../api/queries';
import type { StandingRow, Tournament } from '../../api/types';
import { QueryState } from '../../components/QueryState';
import { StandingsTable } from '../../components/StandingsTable';
import { groupLetter } from '../../lib/format';

/** Copa: uma tabela por grupo, com os classificados marcados. */
export function GroupsTab({ tournament }: { tournament: Tournament }) {
  const standings = useStandings(tournament.id);
  const qualifiers = tournament.options.qualifiersPerGroup ?? 1;
  return (
    <QueryState query={standings}>
      {(rows) => {
        const groups = new Map<number, StandingRow[]>();
        for (const row of rows) groups.set(row.groupNumber, [...(groups.get(row.groupNumber) ?? []), row]);
        return (
          <>
            <p className="muted">
              {qualifiers === 1 ? 'O primeiro de cada grupo vai para o mata-mata.' : `Os ${qualifiers} primeiros de cada grupo vão para o mata-mata.`}
            </p>
            {[...groups.entries()].map(([number, list]) => (
              <section key={number}>
                <h2>Grupo {groupLetter(number)}</h2>
                <StandingsTable rows={list} label={`Classificação do Grupo ${groupLetter(number)}`} />
              </section>
            ))}
            <p className="muted">Vitória vale 3 pontos e empate 1. Desempate: confronto direto, vitórias, saldo de gols e gols marcados.</p>
          </>
        );
      }}
    </QueryState>
  );
}
