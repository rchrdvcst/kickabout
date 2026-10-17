import { useSearchParams } from 'react-router';
import { useTournaments } from '../api/queries';
import type { TournamentStatus } from '../api/types';
import { QueryState } from '../components/QueryState';
import { Tabs } from '../components/Tabs';
import { TournamentList } from '../components/TournamentList';

const FILTERS: { id: TournamentStatus; label: string; empty: string }[] = [
  { id: 'in_progress', label: 'Em andamento', empty: 'Nenhum campeonato em andamento.' },
  { id: 'finished', label: 'Encerrados', empty: 'Nenhum campeonato encerrado.' },
  { id: 'draft', label: 'Em preparação', empty: 'Nenhum campeonato em preparação.' },
];

export function TournamentsPage() {
  const [params] = useSearchParams();
  const filter = FILTERS.find((f) => f.id === params.get('status')) ?? FILTERS[0]!;
  const tournaments = useTournaments(filter.id);

  return (
    <>
      <h1>Campeonatos</h1>
      <Tabs param="status" items={FILTERS} current={filter.id} label="Situação do campeonato" />
      <QueryState query={tournaments} isEmpty={(list) => list.length === 0} empty={<p className="state">{filter.empty}</p>}>
        {(list) => <TournamentList items={list} />}
      </QueryState>
    </>
  );
}
