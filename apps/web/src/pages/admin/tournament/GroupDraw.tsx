import { drawGroups } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import type { Tournament } from '../../../api/types';
import { FormError } from '../../../components/FormError';
import { TeamBadge } from '../../../components/TeamBadge';
import { groupLetter } from '../../../lib/format';

/** Copa em rascunho: sorteio dos grupos com prévia, dá para sortear de novo até iniciar. */
export function GroupDraw({ tournament }: { tournament: Tournament }) {
  const draw = useApiMutation(() => drawGroups(tournament.id));
  const groups = tournament.groupDraw ?? null;

  return (
    <section aria-labelledby="group-draw-title" className="draw-block">
      <h2 id="group-draw-title">Sorteio dos grupos</h2>
      {groups ? (
        <div className="draw-groups">
          {groups.map((group, index) => (
            <div key={index}>
              <h3>Grupo {groupLetter(index + 1)}</h3>
              <ul className="list">
                {group.map((team) => (
                  <li key={team.id} className="admin-row">
                    <TeamBadge team={team} />
                    <span className="row-title">{team.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Com as inscrições salvas, sorteie os times nos grupos. Dá para sortear de novo até iniciar.</p>
      )}
      <FormError error={draw.error} />
      <div className="actions">
        <button
          type="button"
          className="button button-secondary"
          disabled={draw.isPending || tournament.entries.length === 0}
          onClick={() => draw.mutate(undefined)}
        >
          {groups ? 'Sortear de novo' : 'Sortear grupos'}
        </button>
      </div>
    </section>
  );
}
