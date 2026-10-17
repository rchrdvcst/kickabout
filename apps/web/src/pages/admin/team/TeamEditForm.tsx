import { useState, type FormEvent } from 'react';
import { updateTeam, type TeamInput } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import type { TeamRef } from '../../../api/types';
import { FormError } from '../../../components/FormError';
import { TeamFields } from './TeamFields';

export function TeamEditForm({ team }: { team: TeamRef }) {
  const [form, setForm] = useState<TeamInput>({ name: team.name, shortName: team.shortName, crestUrl: team.crestUrl });
  const update = useApiMutation((input: TeamInput) => updateTeam(team.id, input));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(form);
  };

  return (
    <form className="form" aria-label="Dados do time" onSubmit={submit}>
      <TeamFields value={form} onChange={setForm} />
      <FormError error={update.error} />
      {update.isSuccess && (
        <p className="notice" role="status">
          Alterações salvas.
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button" disabled={update.isPending}>
          Salvar alterações
        </button>
      </div>
    </form>
  );
}
