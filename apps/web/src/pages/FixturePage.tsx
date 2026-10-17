import { Link, useParams } from 'react-router';
import { useBracket, useFixture, useTournament } from '../api/queries';
import type { DuelView } from '../api/types';
import { DuelStrip } from '../components/DuelStrip';
import { QueryState } from '../components/QueryState';
import { Scoreboard } from '../components/Scoreboard';
import { outcomeOf, roundCounts, roundLabel } from '../lib/format';

function DuelItem({ duel }: { duel: DuelView }) {
  const outcome = outcomeOf(duel);
  const playerClass = (side: 'A' | 'B') => `duel-player${side === 'B' ? ' duel-player-b' : ''}${outcome === side ? ' duel-winner' : ''}`;
  return (
    <li className={duel.order === 6 ? 'duel-tiebreak' : undefined}>
      <span className="duel-order">{duel.order === 6 ? 'Desempate' : `${duel.order}º`}</span>
      <Link to={`/jogadores/${duel.playerA.id}`} className={playerClass('A')}>
        {duel.playerA.name}
      </Link>
      <span className="duel-score">
        {duel.goalsA} × {duel.goalsB}
        {duel.penaltiesA !== null && duel.penaltiesB !== null && (
          <small>
            ({duel.penaltiesA} × {duel.penaltiesB} nos pênaltis)
          </small>
        )}
      </span>
      <Link to={`/jogadores/${duel.playerB.id}`} className={playerClass('B')}>
        {duel.playerB.name}
      </Link>
    </li>
  );
}

export function FixturePage() {
  const { id = '', matchId = '' } = useParams();
  const fixture = useFixture(id, Number(matchId));
  const tournament = useTournament(id);
  const bracket = useBracket(id);

  return (
    <QueryState query={fixture}>
      {(f) => {
        const counts = roundCounts(bracket.data?.data ?? null);
        const round = tournament.data
          ? roundLabel(tournament.data.format, f.groupNumber, f.roundNumber, counts.get(f.groupNumber) ?? f.roundNumber)
          : null;
        return (
          <>
            <p className="hero-context">
              <Link to={`/campeonatos/${id}?aba=jogos`}>{tournament.data?.name ?? 'Campeonato'}</Link>
              {round && <span>, {round}</span>}
            </p>
            <h1 className="visually-hidden">
              {f.teamA.name} contra {f.teamB.name}
            </h1>
            <Scoreboard teamA={f.teamA} teamB={f.teamB} scoreA={f.scoreA} scoreB={f.scoreB} />
            {f.status === 'pending' ? (
              <p className="state">Aguardando resultado.</p>
            ) : (
              <>
                {f.status === 'draft' && <p className="notice">Resultado parcial: ainda faltam duelos.</p>}
                <DuelStrip duels={f.duels} teamA={f.teamA.name} teamB={f.teamB.name} />
                <ol className="duel-list" aria-label="Duelos">
                  {f.duels.map((duel) => (
                    <DuelItem key={duel.order} duel={duel} />
                  ))}
                </ol>
              </>
            )}
          </>
        );
      }}
    </QueryState>
  );
}
