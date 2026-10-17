import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { createPlayer, setPlayerTeam, updatePlayer } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useAdminPlayers, useTeams } from '../../api/queries';
import type { AdminPlayer, TeamSummary } from '../../api/types';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { formatPhone } from '../../lib/format';

export function AdminPlayersPage() {
  const [search, setSearch] = useState('');
  const players = useAdminPlayers(search.trim());
  const teams = useTeams();
  const [editing, setEditing] = useState<string | null>(null);
  const teamList = teams.data ?? [];

  return (
    <>
      <h1>Jogadores</h1>
      <label className="field">
        <span>Buscar por nome ou celular</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <QueryState query={players} isEmpty={(list) => list.length === 0} empty={<p className="state">Nenhum jogador encontrado.</p>}>
        {(list) => (
          <ul aria-label="Jogadores">
            {list.map((player) =>
              editing === player.id ? (
                <li key={player.id}>
                  <PlayerEditor player={player} teams={teamList} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li key={player.id} className="admin-row">
                  <Link to={`/jogadores/${player.id}`} className="row-title">
                    {player.name}
                  </Link>
                  <span className="muted num">{formatPhone(player.phone)}</span>
                  <span className="muted">{player.team?.name ?? 'Sem time'}</span>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    aria-label={`Editar ${player.name}`}
                    onClick={() => setEditing(player.id)}
                  >
                    Editar
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </QueryState>
      <NewPlayer teams={teamList} />
    </>
  );
}

function TeamSelect({ label, teams, value, onChange }: { label: string; teams: TeamSummary[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sem time</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlayerEditor({ player, teams, onDone }: { player: AdminPlayer; teams: TeamSummary[]; onDone: () => void }) {
  const initialPhone = formatPhone(player.phone);
  const [name, setName] = useState(player.name);
  const [phone, setPhone] = useState(initialPhone);
  const [teamId, setTeamId] = useState(player.team?.id ?? '');
  const save = useApiMutation(async () => {
    if (name !== player.name || phone !== initialPhone) await updatePlayer(player.id, { name, phone });
    const target = teamId === '' ? null : teamId;
    if (target !== (player.team?.id ?? null)) await setPlayerTeam(player.id, target);
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(undefined, { onSuccess: onDone });
  };

  return (
    <form className="form" aria-label={`Editar ${player.name}`} onSubmit={submit}>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Celular com DDD</span>
        <input type="tel" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <TeamSelect label="Time" teams={teams} value={teamId} onChange={setTeamId} />
      <FormError error={save.error} />
      <div className="actions">
        <button type="submit" className="button" disabled={save.isPending}>
          Salvar
        </button>
        <button type="button" className="button button-secondary" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function NewPlayer({ teams }: { teams: TeamSummary[] }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [teamId, setTeamId] = useState('');
  const create = useApiMutation(createPlayer);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { name, phone, teamId: teamId === '' ? null : teamId },
      {
        onSuccess: () => {
          setName('');
          setPhone('');
        },
      },
    );
  };

  return (
    <>
      <h2>Novo jogador</h2>
      <form className="form" aria-label="Novo jogador" onSubmit={submit}>
        <label className="field">
          <span>Nome</span>
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Celular com DDD</span>
          <input type="tel" inputMode="tel" required placeholder="(11) 98765-4321" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <TeamSelect label="Time (opcional)" teams={teams} value={teamId} onChange={setTeamId} />
        <FormError error={create.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={create.isPending}>
            Cadastrar jogador
          </button>
        </div>
      </form>
    </>
  );
}
