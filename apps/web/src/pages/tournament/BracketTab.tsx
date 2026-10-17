import { useBracket } from '../../api/queries';
import type { Tournament } from '../../api/types';
import { BracketView } from '../../components/BracketView';
import { QueryState } from '../../components/QueryState';
import { phaseData } from '../../lib/format';

function waitingText(tournament: Tournament): string {
  const pending = tournament.groupsPending ?? 0;
  if (pending === 0) return 'A fase de grupos terminou. A chave aparece assim que o mata-mata for sorteado.';
  return `A chave é sorteada quando a fase de grupos terminar. ${pending === 1 ? 'Falta 1 jogo.' : `Faltam ${pending} jogos.`}`;
}

export function BracketTab({ tournament }: { tournament: Tournament }) {
  const bracket = useBracket(tournament.id);
  const cup = tournament.format === 'cup';
  return (
    <QueryState query={bracket}>
      {({ data }) => {
        const shown = data && cup ? phaseData(data, 'knockout') : data;
        if (shown) return <BracketView data={shown} />;
        return <p className="state">{cup ? waitingText(tournament) : 'A chave aparece quando o campeonato começar.'}</p>;
      }}
    </QueryState>
  );
}
