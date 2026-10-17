import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { finishTournament, updateTournament, type TournamentInput } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useTournament } from '../../api/queries';
import type { Tournament } from '../../api/types';
import { ConfirmButton } from '../../components/ConfirmButton';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { FORMAT_LABEL, STATUS_LABEL } from '../../lib/format';
import { FixturesTab } from '../tournament/FixturesTab';
import { EntriesEditor } from './tournament/EntriesEditor';
import { TournamentFields } from './tournament/TournamentFields';

export function AdminTournamentPage() {
  const { id = '' } = useParams();
  const tournament = useTournament(id);

  return (
    <QueryState query={tournament}>
      {(t) => (
        <>
          <header className="page-header">
            <h1>{t.name}</h1>
            <p className="muted">
              {FORMAT_LABEL[t.format]}, {STATUS_LABEL[t.status].toLowerCase()}. <Link to={`/campeonatos/${t.id}`}>Ver página pública</Link>
            </p>
          </header>
          {t.status === 'draft' ? (
            <>
              <SettingsForm key={t.id} tournament={t} />
              <EntriesEditor key={t.entries.map((entry) => entry.team.id).join()} tournament={t} />
            </>
          ) : (
            <>
              <RenameForm key={t.id} tournament={t} />
              <h2>Confrontos</h2>
              <p className="muted">Abra um confronto para lançar ou corrigir o resultado.</p>
              <FixturesTab tournament={t} fixtureUrl={(matchId) => `/admin/campeonatos/${t.id}/jogos/${matchId}`} />
              {t.status === 'in_progress' ? (
                <FinishSection tournament={t} />
              ) : (
                <p className="notice">Campeonato encerrado. Os títulos já foram gerados.</p>
              )}
            </>
          )}
        </>
      )}
    </QueryState>
  );
}

function SettingsForm({ tournament }: { tournament: Tournament }) {
  const [form, setForm] = useState<TournamentInput>({ name: tournament.name, format: tournament.format, options: tournament.options });
  const update = useApiMutation((input: TournamentInput) => updateTournament(tournament.id, input));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(form);
  };

  return (
    <form className="form" aria-label="Configuração" onSubmit={submit}>
      <h2>Configuração</h2>
      <TournamentFields value={form} onChange={setForm} />
      <FormError error={update.error} />
      {update.isSuccess && (
        <p className="notice" role="status">
          Configuração salva.
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button" disabled={update.isPending}>
          Salvar configuração
        </button>
      </div>
    </form>
  );
}

function RenameForm({ tournament }: { tournament: Tournament }) {
  const [name, setName] = useState(tournament.name);
  const update = useApiMutation((value: string) => updateTournament(tournament.id, { name: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(name);
  };

  return (
    <form className="form" aria-label="Nome do campeonato" onSubmit={submit}>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <FormError error={update.error} />
      {update.isSuccess && (
        <p className="notice" role="status">
          Nome salvo.
        </p>
      )}
      <div className="actions">
        <button type="submit" className="button" disabled={update.isPending}>
          Salvar nome
        </button>
      </div>
    </form>
  );
}

function FinishSection({ tournament }: { tournament: Tournament }) {
  const finish = useApiMutation(() => finishTournament(tournament.id));
  return (
    <section>
      <h2>Encerrar</h2>
      <p className="muted">Com todos os confrontos lançados, encerre para gerar os títulos (campeão, vice e 3º).</p>
      <FormError error={finish.error} />
      <ConfirmButton
        label="Encerrar campeonato"
        confirmLabel="Confirmar encerramento"
        danger
        disabled={finish.isPending}
        onConfirm={() => finish.mutate(undefined)}
      />
    </section>
  );
}
