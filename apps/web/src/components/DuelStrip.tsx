import type { CSSProperties } from 'react';
import type { DuelView } from '../api/types';
import { outcomeOf } from '../lib/format';

interface Props {
  duels: DuelView[];
  teamA: string;
  teamB: string;
}

export function DuelStrip({ duels, teamA, teamB }: Props) {
  return (
    <ol className="duel-strip" aria-label="Resultado de cada duelo">
      {duels.map((duel, index) => {
        const outcome = outcomeOf(duel);
        const side = outcome === 'A' ? 'a' : outcome === 'B' ? 'b' : 'draw';
        const name = duel.order === 6 ? 'Desempate' : `${duel.order}º duelo`;
        const result = outcome === 'draw' ? 'empate' : `${outcome === 'A' ? teamA : teamB} venceu`;
        return (
          <li
            key={duel.order}
            className={`duel-seg duel-seg-${side}${duel.order === 6 ? ' duel-seg-tiebreak' : ''}`}
            style={{ '--i': index } as CSSProperties}
          >
            <span className="visually-hidden">
              {name}: {result}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
