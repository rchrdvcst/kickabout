import { useBracket } from '../../api/queries';
import { BracketView } from '../../components/BracketView';
import { QueryState } from '../../components/QueryState';

export function BracketTab({ id }: { id: string }) {
  const bracket = useBracket(id);
  return (
    <QueryState query={bracket}>
      {({ data }) => (data ? <BracketView data={data} /> : <p className="state">A chave aparece quando o campeonato começar.</p>)}
    </QueryState>
  );
}
