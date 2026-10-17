import { drawKnockout, undoKnockoutDraw } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import type { Tournament } from '../../../api/types';
import { ConfirmButton } from '../../../components/ConfirmButton';
import { FormError } from '../../../components/FormError';

/** Copa em andamento: sortear o mata-mata quando os grupos acabam; sortear de novo ou desfazer antes do 1º resultado. */
export function KnockoutDraw({ tournament }: { tournament: Tournament }) {
  const draw = useApiMutation(() => drawKnockout(tournament.id));
  const undo = useApiMutation(() => undoKnockoutDraw(tournament.id));
  const pending = tournament.groupsPending ?? 0;
  const busy = draw.isPending || undo.isPending;

  return (
    <section aria-labelledby="knockout-draw-title" className="draw-block">
      <h2 id="knockout-draw-title">Mata-mata</h2>
      {tournament.knockoutDrawn ? (
        <>
          <p className="muted">
            Chave sorteada. Enquanto nenhum jogo do mata-mata tiver resultado, dá para sortear de novo ou desfazer o sorteio
            para voltar a corrigir os grupos.
          </p>
          <div className="actions">
            <ConfirmButton label="Sortear de novo" confirmLabel="Confirmar novo sorteio" disabled={busy} onConfirm={() => draw.mutate(undefined)} />
            <ConfirmButton
              label="Desfazer sorteio do mata-mata"
              confirmLabel="Confirmar: volta para a fase de grupos"
              danger
              disabled={busy}
              onConfirm={() => undo.mutate(undefined)}
            />
          </div>
        </>
      ) : pending > 0 ? (
        <p className="muted">
          O sorteio do mata-mata fica disponível quando a fase de grupos terminar. {pending === 1 ? 'Falta 1 jogo.' : `Faltam ${pending} jogos.`}
        </p>
      ) : (
        <>
          <p>A fase de grupos terminou. Sorteie o mata-mata: times do mesmo grupo não se enfrentam na primeira rodada.</p>
          <div className="actions">
            <button type="button" className="button" disabled={busy} onClick={() => draw.mutate(undefined)}>
              Sortear mata-mata
            </button>
          </div>
        </>
      )}
      <FormError error={draw.error ?? undo.error} />
    </section>
  );
}
