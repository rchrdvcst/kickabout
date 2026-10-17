import { useState } from 'react';
import { setEntries, startTournament } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import { useTeams } from '../../../api/queries';
import type { Tournament } from '../../../api/types';
import { ConfirmButton } from '../../../components/ConfirmButton';
import { FormError } from '../../../components/FormError';
import { MIN_TEAMS } from '../../../lib/format';
import { GroupDraw } from './GroupDraw';

/** Times inscritos em ordem de seed; iniciar só com as inscrições salvas. */
export function EntriesEditor({ tournament, settingsDirty = false }: { tournament: Tournament; settingsDirty?: boolean }) {
  const teams = useTeams();
  const saved = tournament.entries.map((entry) => entry.team.id);
  const [ids, setIds] = useState<string[]>(saved);
  const save = useApiMutation((teamIds: string[]) => setEntries(tournament.id, teamIds));
  const start = useApiMutation(() => startTournament(tournament.id));

  const dirty = ids.join() !== saved.join();
  const min = MIN_TEAMS[tournament.format];
  const needsDraw = tournament.format === 'cup' && !tournament.groupDraw;
  const names = new Map<string, string>([
    ...(teams.data ?? []).map((team) => [team.id, team.name] as const),
    ...tournament.entries.map((entry) => [entry.team.id, entry.team.name] as const),
  ]);
  const available = (teams.data ?? []).filter((team) => !ids.includes(team.id));

  const swap = (from: number, to: number) =>
    setIds((current) => {
      const next = [...current];
      [next[from], next[to]] = [next[to]!, next[from]!];
      return next;
    });

  return (
    <section aria-label="Times inscritos">
      <h2>Times inscritos</h2>
      <p className="muted">A ordem define os seeds: o primeiro é o cabeça de chave. Mínimo de {min} times para iniciar.</p>
      {ids.length === 0 ? (
        <p className="state">Nenhum time inscrito.</p>
      ) : (
        <ol aria-label="Ordem dos seeds">
          {ids.map((teamId, index) => {
            const name = names.get(teamId) ?? teamId;
            return (
              <li key={teamId} className="admin-row">
                <span className="muted num">{index + 1}</span>
                <span className="row-title">{name}</span>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  aria-label={`Subir ${name}`}
                  disabled={index === 0}
                  onClick={() => swap(index, index - 1)}
                >
                  Subir
                </button>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  aria-label={`Descer ${name}`}
                  disabled={index === ids.length - 1}
                  onClick={() => swap(index, index + 1)}
                >
                  Descer
                </button>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  aria-label={`Tirar ${name}`}
                  onClick={() => setIds((current) => current.filter((id) => id !== teamId))}
                >
                  Tirar
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {available.length > 0 && (
        <label className="field">
          <span>Inscrever time</span>
          <select value="" onChange={(e) => e.target.value && setIds((current) => [...current, e.target.value])}>
            <option value="">Escolha um time…</option>
            {available.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {tournament.format === 'cup' && !dirty && <GroupDraw tournament={tournament} settingsDirty={settingsDirty} />}
      <FormError error={save.error ?? start.error} />
      <div className="actions">
        <button type="button" className="button button-secondary" disabled={!dirty || save.isPending} onClick={() => save.mutate(ids)}>
          Salvar inscrições
        </button>
        <ConfirmButton
          label="Iniciar campeonato"
          confirmLabel="Confirmar início: a chave não pode ser refeita"
          disabled={dirty || settingsDirty || ids.length < min || needsDraw || start.isPending}
          onConfirm={() => start.mutate(undefined)}
        />
      </div>
      {dirty && <p className="muted">Salve as inscrições antes de iniciar.</p>}
      {!dirty && needsDraw && <p className="muted">Sorteie os grupos antes de iniciar.</p>}
      {!dirty && settingsDirty && tournament.format !== 'cup' && <p className="muted">Salve a configuração antes de iniciar.</p>}
    </section>
  );
}
