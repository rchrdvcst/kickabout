import { useParams, useSearchParams } from 'react-router';
import { useTournament } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { Tabs } from '../../components/Tabs';
import { FORMAT_LABEL, STATUS_LABEL } from '../../lib/format';
import { BracketTab } from './BracketTab';
import { FixturesTab } from './FixturesTab';
import { StandingsTab } from './StandingsTab';
import { StatsTab } from './StatsTab';
import { TeamsTab } from './TeamsTab';

export function TournamentPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const tournament = useTournament(id);

  return (
    <QueryState query={tournament}>
      {(t) => {
        const tabs = [
          { id: 'chave', label: t.format === 'round_robin' ? 'Tabela' : 'Chave' },
          { id: 'jogos', label: 'Jogos' },
          { id: 'times', label: 'Times' },
          { id: 'estatisticas', label: 'Estatísticas' },
        ];
        const current = tabs.find((tab) => tab.id === params.get('aba'))?.id ?? 'chave';
        const notStarted = t.status === 'draft' && current !== 'times';

        return (
          <>
            <header className="page-header">
              <h1>{t.name}</h1>
              <p className="muted">
                {FORMAT_LABEL[t.format]}, {t.entries.length} times, {STATUS_LABEL[t.status].toLowerCase()}.
              </p>
            </header>
            <Tabs param="aba" items={tabs} current={current} label="Seções do campeonato" />
            {notStarted ? (
              <p className="state">A chave aparece quando o campeonato começar.</p>
            ) : current === 'chave' ? (
              t.format === 'round_robin' ? <StandingsTab id={t.id} /> : <BracketTab id={t.id} />
            ) : current === 'jogos' ? (
              <FixturesTab tournament={t} />
            ) : current === 'times' ? (
              <TeamsTab tournament={t} />
            ) : (
              <StatsTab id={t.id} />
            )}
          </>
        );
      }}
    </QueryState>
  );
}
