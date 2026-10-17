import { MAX_ACTIVE_ROSTER } from '@kickabout/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createTeam, type TeamInput } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useTeams } from '../../api/queries';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { TeamBadge } from '../../components/TeamBadge';
import { TeamFields, emptyTeam } from './team/TeamFields';

export function AdminTeamsPage() {
  const teams = useTeams();
  const navigate = useNavigate();
  const [form, setForm] = useState<TeamInput>(emptyTeam);
  const create = useApiMutation(createTeam);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(form, { onSuccess: (team) => navigate(`/admin/times/${team.id}`) });
  };

  return (
    <>
      <h1>Times</h1>
      <QueryState query={teams} isEmpty={(list) => list.length === 0} empty={<p className="state">Nenhum time cadastrado ainda.</p>}>
        {(list) => (
          <ul className="list">
            {list.map((team) => (
              <li key={team.id}>
                <Link to={`/admin/times/${team.id}`} className="row-link">
                  <TeamBadge team={team} />
                  <span className="row-title">{team.name}</span>
                  <span className="row-meta">
                    {team.playerCount} de {MAX_ACTIVE_ROSTER} jogadores
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      <h2>Novo time</h2>
      <form className="form" aria-label="Novo time" onSubmit={submit}>
        <TeamFields value={form} onChange={setForm} />
        <FormError error={create.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={create.isPending}>
            Cadastrar time
          </button>
        </div>
      </form>
    </>
  );
}
