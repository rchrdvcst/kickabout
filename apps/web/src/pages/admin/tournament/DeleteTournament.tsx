import { useState } from 'react';
import { useNavigate } from 'react-router';
import { deleteTournament } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import { useTournamentFixtures } from '../../../api/queries';
import type { Tournament } from '../../../api/types';
import { ConfirmButton } from '../../../components/ConfirmButton';
import { FormError } from '../../../components/FormError';

const confrontos = (count: number) => (count === 1 ? '1 confronto' : `${count} confrontos`);

/** Exclusão em duas etapas; com resultado lançado, também pede o nome do campeonato. Os títulos ficam no histórico. */
export function DeleteTournament({ tournament }: { tournament: Tournament }) {
  const navigate = useNavigate();
  const started = tournament.status !== 'draft';
  const fixtures = useTournamentFixtures(tournament.id, started);
  const [typed, setTyped] = useState('');
  // Sai da página antes de a mutação invalidar as consultas: a do campeonato excluído não é buscada de novo.
  const remove = useApiMutation(async () => {
    await deleteTournament(tournament.id);
    navigate('/admin/campeonatos', { state: { notice: 'Campeonato excluído.' } });
  });

  const list = fixtures.data ?? [];
  const hasResults = list.some((fixture) => fixture.status !== 'pending');
  const ready = !started || fixtures.isSuccess;
  const nameOk = !hasResults || typed.trim() === tournament.name;

  return (
    <details className="settings" aria-label="Excluir campeonato">
      <summary>Excluir campeonato</summary>
      {ready && (
        <p className="muted">
          {started
            ? `Isto apaga o campeonato, ${confrontos(list.length)} e as estatísticas desses jogos.`
            : 'Isto apaga o campeonato e as inscrições.'}{' '}
          {tournament.status === 'finished' ? 'Os títulos continuam no histórico.' : 'Times e jogadores continuam cadastrados.'}
        </p>
      )}
      {hasResults && (
        <label className="field">
          <span>Digite o nome do campeonato para confirmar</span>
          <input value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
        </label>
      )}
      <FormError error={remove.error} />
      <div className="actions">
        <ConfirmButton
          label="Excluir campeonato"
          confirmLabel="Excluir de vez"
          danger
          disabled={!ready || !nameOk || remove.isPending}
          onConfirm={() => remove.mutate(undefined)}
        />
      </div>
    </details>
  );
}
