import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { createTournament, type TournamentInput } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useTournaments } from '../../api/queries';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { FORMAT_LABEL, STATUS_LABEL } from '../../lib/format';
import { TournamentFields } from './tournament/TournamentFields';

export function AdminTournamentsPage() {
  const tournaments = useTournaments();
  const navigate = useNavigate();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [form, setForm] = useState<TournamentInput>({ name: '', format: 'single_elimination', options: {} });
  const create = useApiMutation(createTournament);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(form, { onSuccess: (tournament) => navigate(`/admin/campeonatos/${tournament.id}`) });
  };

  return (
    <>
      <h1>Campeonatos</h1>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <QueryState query={tournaments} isEmpty={(list) => list.length === 0} empty={<p className="state">Nenhum campeonato criado ainda.</p>}>
        {(list) => (
          <ul className="list">
            {list.map((tournament) => (
              <li key={tournament.id}>
                <Link to={`/admin/campeonatos/${tournament.id}`} className="row-link">
                  <span className="row-title">{tournament.name}</span>
                  <span className="row-meta">
                    {FORMAT_LABEL[tournament.format]}, {STATUS_LABEL[tournament.status].toLowerCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      <h2>Novo campeonato</h2>
      <form className="form" aria-label="Novo campeonato" onSubmit={submit}>
        <TournamentFields value={form} onChange={setForm} />
        <FormError error={create.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={create.isPending}>
            Criar campeonato
          </button>
        </div>
      </form>
    </>
  );
}
