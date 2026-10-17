import type { CSSProperties } from 'react';
import type { DuelView } from '../api/types';
import { outcomeOf } from '../lib/format';

interface Props {
  duels: DuelView[];
  teamA: string;
  teamB: string;
  /** Siglas dos times: com elas, cada segmento mostra quem venceu o duelo. */
  tags?: [string, string];
}

export function DuelStrip({ duels, teamA, teamB, tags }: Props) {
  // Vencedor do confronto = quem venceu mais duelos (o desempate conta como um duelo); empate = ninguém.
  const wins = { A: 0, B: 0, draw: 0 };
  for (const duel of duels) wins[outcomeOf(duel)] += 1;
  const matchWinner = wins.A > wins.B ? 'A' : wins.B > wins.A ? 'B' : null;
  return (
    <ol className={tags ? 'duel-strip duel-strip-tagged' : 'duel-strip'} aria-label="Resultado de cada duelo">
      {duels.map((duel, index) => {
        const outcome = outcomeOf(duel);
        const side = outcome === 'A' ? 'a' : outcome === 'B' ? 'b' : 'draw';
        const name = duel.order === 6 ? 'Desempate' : `${duel.order}º duelo`;
        const result = outcome === 'draw' ? 'empate' : `${outcome === 'A' ? teamA : teamB} venceu`;
        return (
          <li
            key={duel.order}
            className={`duel-seg duel-seg-${side}${duel.order === 6 ? ' duel-seg-tiebreak' : ''}${
              tags && outcome === matchWinner ? ' duel-seg-winner' : ''
            }`}
            style={{ '--i': index } as CSSProperties}
          >
            {tags && (
              <span className="duel-seg-tag" aria-hidden="true">
                {outcome === 'draw' ? '=' : outcome === 'A' ? tags[0] : tags[1]}
              </span>
            )}
            <span className="visually-hidden">
              {name}: {result}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
