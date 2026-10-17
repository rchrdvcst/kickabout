import { MAX_ACTIVE_ROSTER } from '@kickabout/shared';
import { useState, type FormEvent } from 'react';
import { createPlayer, setPlayerTeam } from '../../../api/admin';
import { useApiMutation } from '../../../api/mutation';
import { useAdminPlayers } from '../../../api/queries';
import type { RosterPlayer } from '../../../api/types';
import { FormError } from '../../../components/FormError';
import { QueryState } from '../../../components/QueryState';
import { formatPhone } from '../../../lib/format';

interface Move {
  playerId: string;
  teamId: string | null;
}

export function RosterManager({ teamId, players }: { teamId: string; players: RosterPlayer[] }) {
  const full = players.length >= MAX_ACTIVE_ROSTER;
  const move = useApiMutation((vars: Move) => setPlayerTeam(vars.playerId, vars.teamId));

  return (
    <section>
      <h2>Elenco</h2>
      <p className="muted">
        {players.length} de {MAX_ACTIVE_ROSTER} jogadores ativos.
      </p>
      {full && (
        <p className="notice" role="status">
          Elenco cheio: {MAX_ACTIVE_ROSTER} jogadores ativos. Remova alguém para adicionar outro.
        </p>
      )}
      <FormError error={move.error} />
      {players.length === 0 ? (
        <p className="state">Nenhum jogador no elenco.</p>
      ) : (
        <ul aria-label="Elenco atual">
          {players.map((player) => (
            <li key={player.id} className="admin-row">
              <span className="row-title">{player.name}</span>
              {player.phone && <span className="muted num">{formatPhone(player.phone)}</span>}
              <button
                type="button"
                className="button button-secondary button-small"
                aria-label={`Remover ${player.name} do elenco`}
                disabled={move.isPending}
                onClick={() => move.mutate({ playerId: player.id, teamId: null })}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <>
          <AddExistingPlayer
            rosterIds={players.map((player) => player.id)}
            pending={move.isPending}
            onAdd={(playerId) => move.mutate({ playerId, teamId })}
          />
          <NewPlayerForm teamId={teamId} />
        </>
      )}
    </section>
  );
}

function AddExistingPlayer({ rosterIds, pending, onAdd }: { rosterIds: string[]; pending: boolean; onAdd: (playerId: string) => void }) {
  const [search, setSearch] = useState('');
  const term = search.trim();
  const results = useAdminPlayers(term, term.length >= 2);

  return (
    <section>
      <h3>Adicionar jogador já cadastrado</h3>
      <label className="field">
        <span>Buscar por nome ou celular</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {term.length >= 2 && (
        <QueryState
          query={results}
          isEmpty={(list) => list.every((player) => rosterIds.includes(player.id))}
          empty={<p className="muted">Nenhum jogador encontrado fora deste elenco.</p>}
        >
          {(list) => (
            <ul aria-label="Jogadores encontrados">
              {list
                .filter((player) => !rosterIds.includes(player.id))
                .map((player) => (
                  <li key={player.id} className="admin-row">
                    <span className="row-title">{player.name}</span>
                    <span className="muted">{player.team ? player.team.name : 'Sem time'}</span>
                    <button
                      type="button"
                      className="button button-small"
                      disabled={pending}
                      aria-label={player.team ? `Transferir ${player.name} de ${player.team.name} para este time` : `Adicionar ${player.name}`}
                      onClick={() => onAdd(player.id)}
                    >
                      {player.team ? 'Transferir' : 'Adicionar'}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </QueryState>
      )}
    </section>
  );
}

function NewPlayerForm({ teamId }: { teamId: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const create = useApiMutation(createPlayer);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { name, phone, teamId },
      {
        onSuccess: () => {
          setName('');
          setPhone('');
        },
      },
    );
  };

  return (
    <form className="form" aria-label="Novo jogador no elenco" onSubmit={submit}>
      <h3>Cadastrar jogador novo</h3>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Celular com DDD</span>
        <input type="tel" inputMode="tel" required placeholder="(11) 98765-4321" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <FormError error={create.error} />
      <div className="actions">
        <button type="submit" className="button" disabled={create.isPending}>
          Cadastrar e adicionar
        </button>
      </div>
    </form>
  );
}
