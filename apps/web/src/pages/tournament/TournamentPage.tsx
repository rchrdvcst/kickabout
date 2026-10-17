import { useParams, useSearchParams } from 'react-router';
import { useTournament } from '../../api/queries';
import { QueryState } from '../../components/QueryState';
import { Tabs } from '../../components/Tabs';
import { FORMAT_LABEL, STATUS_LABEL } from '../../lib/format';
import { BracketTab } from './BracketTab';
import { FixturesTab } from './FixturesTab';
import { GroupsTab } from './GroupsTab';
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
        const cup = t.format === 'cup';
        const tabs = [
          ...(cup ? [{ id: 'grupos', label: 'Grupos' }] : []),
          { id: 'chave', label: t.format === 'round_robin' ? 'Tabela' : 'Chave' },
          { id: 'jogos', label: 'Jogos' },
          { id: 'times', label: 'Times' },
          { id: 'estatisticas', label: 'Estatísticas' },
        ];
        const current = tabs.find((tab) => tab.id === params.get('aba'))?.id ?? tabs[0]!.id;
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
              <p className="state">
                {cup
                  ? 'Os grupos aparecem quando o campeonato começar.'
                  : t.format === 'round_robin'
                    ? 'A tabela aparece quando o campeonato começar.'
                    : 'A chave aparece quando o campeonato começar.'}
              </p>
            ) : current === 'grupos' ? (
              <GroupsTab tournament={t} />
            ) : current === 'chave' ? (
              t.format === 'round_robin' ? <StandingsTab id={t.id} /> : <BracketTab tournament={t} />
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
