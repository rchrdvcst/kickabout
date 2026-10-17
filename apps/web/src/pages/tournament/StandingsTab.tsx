import { useStandings } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { StandingsTable } from '../../components/StandingsTable';

export function StandingsTab({ id }: { id: string }) {
  const standings = useStandings(id);
  return (
    <QueryState query={standings}>
      {(rows) => (
        <>
          <StandingsTable rows={rows} />
          <p className="muted">
            Vitória vale 3 pontos e empate 1. Desempate: confronto direto, vitórias, saldo de gols e gols marcados.
          </p>
        </>
      )}
    </QueryState>
  );
}
