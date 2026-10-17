import { Link, useParams } from 'react-router';
import { useBracket, useFixture, useMe, useTournament } from '../api/queries';
import type { DuelView } from '../api/types';
import { DuelStrip } from '../components/DuelStrip';
import { QueryState } from '../components/QueryState';
import { Scoreboard } from '../components/Scoreboard';
import { fixtureRoundLabel, outcomeOf } from '../lib/format';
import { NotFoundPage } from './NotFoundPage';

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
  const valid = /^\d+$/.test(matchId);
  const fixture = useFixture(id, Number(matchId), valid);
  const tournament = useTournament(id);
  const bracket = useBracket(id);
  const me = useMe();

  if (!valid) return <NotFoundPage />;

  return (
    <QueryState query={fixture}>
      {(f) => {
        const round = tournament.data ? fixtureRoundLabel(tournament.data.format, bracket.data?.data ?? null, f) : null;
        return (
          <>
            <p className="hero-context">
              <Link to={`/campeonatos/${id}?aba=jogos`}>{tournament.data?.name ?? 'Campeonato'}</Link>
              {round && <span>, {round}</span>}
            </p>
            <h1 className="visually-hidden">
              {f.teamA.name} contra {f.teamB.name}
            </h1>
            {me.data?.user && tournament.data?.status === 'in_progress' && (
              <p>
                <Link to={`/admin/campeonatos/${id}/jogos/${f.matchId}`} className="button-link">
                  {f.status === 'completed' ? 'Corrigir resultado' : 'Lançar resultado'}
                </Link>
              </p>
            )}
            <Scoreboard teamA={f.teamA} teamB={f.teamB} scoreA={f.scoreA} scoreB={f.scoreB} />
            {f.status === 'pending' ? (
              <p className="state">Aguardando resultado.</p>
            ) : (
              <>
                {f.status === 'draft' && <p className="notice">Resultado parcial: ainda faltam duelos.</p>}
                <DuelStrip duels={f.duels} teamA={f.teamA.name} teamB={f.teamB.name} tags={[f.teamA.shortName, f.teamB.shortName]} />
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
