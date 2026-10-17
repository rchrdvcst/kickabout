import { validateFixtureResult, type DuelInput } from '@kickabout/shared';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { reopenResult, saveResult } from '../../api/admin';
import { ApiError } from '../../api/client';
import { useApiMutation } from '../../api/mutation';
import { useTournamentFixtures } from '../../api/queries';
import type { FixtureDetail, PlayerRef } from '../../api/types';
import { ConfirmButton } from '../../components/ConfirmButton';
import { FormError } from '../../components/FormError';
import { Scoreboard } from '../../components/Scoreboard';
import {
  TIEBREAK_INDEX,
  duelsToSend,
  invalidScoreLabels,
  liveScore,
  penaltiesNeeded,
  playerOptions,
  rowsFromDuels,
  tiebreakNeeded,
  type DuelRow,
} from '../../lib/result-form';

type Mode = 'draft' | 'final';

interface Props {
  tournamentId: string;
  fixture: FixtureDetail;
  rosterA: PlayerRef[];
  rosterB: PlayerRef[];
}

/** Confrontos que precisam ser reabertos antes (erro RESULT_LOCKED). */
const blockingOf = (error: unknown): number[] =>
  error instanceof ApiError && error.code === 'RESULT_LOCKED'
    ? ((error.details as { blockingMatchIds?: number[] } | undefined)?.blockingMatchIds ?? [])
    : [];

export function ResultForm({ tournamentId, fixture, rosterA, rosterB }: Props) {
  const [rows, setRows] = useState(() => rowsFromDuels(fixture.duels));
  const [issues, setIssues] = useState<string[]>([]);
  const [saved, setSaved] = useState<Mode | null>(null);
  const busy = useRef(false);
  const fixtures = useTournamentFixtures(tournamentId);
  const save = useApiMutation((vars: { mode: Mode; duels: DuelInput[] }) => saveResult(tournamentId, fixture.matchId, vars.mode, vars.duels));
  const reopen = useApiMutation(() => reopenResult(tournamentId, fixture.matchId));

  const knockout = fixture.isKnockout;
  const showTiebreak = tiebreakNeeded(rows, knockout);
  const score = liveScore(rows, knockout);
  const teamA = fixture.teamA.name;
  const teamB = fixture.teamB.name;

  const update = (index: number, patch: Partial<DuelRow>) => {
    setSaved(null);
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const send = (mode: Mode) => {
    if (busy.current) return;
    const invalid = invalidScoreLabels(rows, showTiebreak);
    if (invalid.length > 0) {
      setIssues([`Placar inválido em ${invalid.join(', ')}: use números de 0 a 99.`]);
      return;
    }
    const duels = duelsToSend(rows, knockout);
    if (mode === 'final') {
      const found = validateFixtureResult({
        mode,
        isKnockout: knockout,
        duels,
        rosterA: rosterA.map((player) => player.id),
        rosterB: rosterB.map((player) => player.id),
      });
      const messages = [...new Set(found.map((issue) => issue.message))];
      setIssues(messages);
      if (messages.length > 0) return;
    } else {
      setIssues([]);
    }
    busy.current = true;
    save.mutate(
      { mode, duels },
      {
        onSuccess: () => setSaved(mode),
        onSettled: () => {
          busy.current = false;
        },
      },
    );
  };

  const blocking = [save.error, reopen.error].map(blockingOf).find((ids) => ids.length > 0) ?? [];
  const fixtureName = (matchId: number) => {
    const found = fixtures.data?.find((item) => item.matchId === matchId);
    return found ? `${found.teamA.name} × ${found.teamB.name}` : `Confronto ${matchId}`;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send('final');
  };

  return (
    <form aria-label="Resultado do confronto" onSubmit={submit}>
      <Scoreboard teamA={fixture.teamA} teamB={fixture.teamB} scoreA={score.scoreA} scoreB={score.scoreB} />
      <ol className="result-grid">
        {rows.slice(0, TIEBREAK_INDEX).map((row, index) => (
          <DuelFields
            key={index}
            index={index}
            row={row}
            rows={rows}
            teamA={teamA}
            teamB={teamB}
            rosterA={rosterA}
            rosterB={rosterB}
            onChange={(patch) => update(index, patch)}
          />
        ))}
        {showTiebreak && (
          <DuelFields
            index={TIEBREAK_INDEX}
            row={rows[TIEBREAK_INDEX]!}
            rows={rows}
            teamA={teamA}
            teamB={teamB}
            rosterA={rosterA}
            rosterB={rosterB}
            onChange={(patch) => update(TIEBREAK_INDEX, patch)}
          />
        )}
      </ol>

      {issues.length > 0 && (
        <div className="state state-error" role="alert">
          <p>Confira o resultado:</p>
          <ul className="issue-list">
            {issues.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <FormError error={save.error ?? reopen.error} />
      {blocking.length > 0 && (
        <ul className="list" aria-label="Confrontos que precisam ser reabertos antes">
          {blocking.map((matchId) => (
            <li key={matchId}>
              <Link to={`/admin/campeonatos/${tournamentId}/jogos/${matchId}`} className="row-link">
                <span className="row-title">{fixtureName(matchId)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {saved && (
        <p className="notice" role="status">
          {saved === 'final' ? 'Resultado confirmado.' : 'Rascunho salvo.'}
        </p>
      )}

      <div className="actions">
        {fixture.status !== 'completed' && (
          <button type="button" className="button button-secondary" disabled={save.isPending} onClick={() => send('draft')}>
            Salvar rascunho
          </button>
        )}
        <button type="submit" className="button" disabled={save.isPending || reopen.isPending}>
          Confirmar resultado
        </button>
        {fixture.status === 'completed' && (
          <ConfirmButton
            label="Reabrir confronto"
            confirmLabel="Confirmar: o resultado volta a rascunho"
            disabled={reopen.isPending || save.isPending}
            onConfirm={() => reopen.mutate(undefined, { onSuccess: () => setSaved(null) })}
          />
        )}
      </div>
      {fixture.status === 'completed' ? (
        <p className="muted">Reabrir tira o resultado da chave, da classificação e das estatísticas até ele ser confirmado de novo.</p>
      ) : (
        <p className="muted">O rascunho guarda só os duelos completos (jogadores e placar) e não conta nas estatísticas nem na chave.</p>
      )}
    </form>
  );
}

interface FieldsProps {
  index: number;
  row: DuelRow;
  rows: DuelRow[];
  teamA: string;
  teamB: string;
  rosterA: PlayerRef[];
  rosterB: PlayerRef[];
  onChange: (patch: Partial<DuelRow>) => void;
}

function DuelFields({ index, row, rows, teamA, teamB, rosterA, rosterB, onChange }: FieldsProps) {
  const tiebreak = index === TIEBREAK_INDEX;
  const label = tiebreak ? 'Desempate' : `${index + 1}º duelo`;
  const goals = (side: 'A' | 'B') => (
    <input
      className={side === 'A' ? 'duel-ga' : 'duel-gb'}
      aria-label={`${label}: gols de ${side === 'A' ? teamA : teamB}`}
      inputMode="numeric"
      maxLength={2}
      value={side === 'A' ? row.goalsA : row.goalsB}
      onChange={(e) => onChange(side === 'A' ? { goalsA: e.target.value } : { goalsB: e.target.value })}
    />
  );
  const player = (side: 'A' | 'B') => (
    <select
      className={side === 'A' ? 'duel-pa' : 'duel-pb'}
      aria-label={`${label}: jogador de ${side === 'A' ? teamA : teamB}`}
      value={side === 'A' ? row.playerAId : row.playerBId}
      onChange={(e) => onChange(side === 'A' ? { playerAId: e.target.value } : { playerBId: e.target.value })}
    >
      <option value="">Jogador</option>
      {playerOptions(side === 'A' ? rosterA : rosterB, rows, side, index).map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );

  return (
    <li className={tiebreak ? 'duel-tiebreak' : undefined}>
      <span className="duel-label">{tiebreak ? 'Desempate (6º duelo): qualquer jogador do elenco' : label}</span>
      {player('A')}
      {goals('A')}
      {goals('B')}
      {player('B')}
      {tiebreak && penaltiesNeeded(row) && (
        <>
          <span className="duel-pen-label">Pênaltis</span>
          <input
            className="duel-pena"
            aria-label={`Pênaltis de ${teamA}`}
            inputMode="numeric"
            maxLength={2}
            value={row.penaltiesA}
            onChange={(e) => onChange({ penaltiesA: e.target.value })}
          />
          <input
            className="duel-penb"
            aria-label={`Pênaltis de ${teamB}`}
            inputMode="numeric"
            maxLength={2}
            value={row.penaltiesB}
            onChange={(e) => onChange({ penaltiesB: e.target.value })}
          />
        </>
      )}
    </li>
  );
}
