import { useState, type FormEvent } from 'react';
import { createTitle, deleteTitle, type TitleInput } from '../../api/admin';
import { useApiMutation } from '../../api/mutation';
import { useTeams, useTitles } from '../../api/queries';
import { ConfirmButton } from '../../components/ConfirmButton';
import { FormError } from '../../components/FormError';
import { QueryState } from '../../components/QueryState';
import { positionLabel } from '../../lib/format';

const POSITIONS: TitleInput['position'][] = [1, 2, 3];

export function AdminTitlesPage() {
  const titles = useTitles();
  const teams = useTeams();
  const [teamId, setTeamId] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [position, setPosition] = useState<TitleInput['position']>(1);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const create = useApiMutation(createTitle);
  const remove = useApiMutation(deleteTitle);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ teamId, tournamentName, position, year: Number(year) }, { onSuccess: () => setTournamentName('') });
  };

  return (
    <>
      <h1>Títulos</h1>
      <p className="muted">Os títulos dos campeonatos encerrados aqui são gerados sozinhos. Use este cadastro para o histórico anterior ao Kickabout.</p>

      <h2>Novo título histórico</h2>
      <form className="form" aria-label="Novo título" onSubmit={submit}>
        <label className="field">
          <span>Time</span>
          <select required value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Escolha um time…</option>
            {(teams.data ?? []).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Campeonato</span>
          <input required maxLength={80} value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} />
        </label>
        <label className="field">
          <span>Posição</span>
          <select value={position} onChange={(e) => setPosition(Number(e.target.value) as TitleInput['position'])}>
            {POSITIONS.map((value) => (
              <option key={value} value={value}>
                {positionLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ano</span>
          <input type="number" required min={1990} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
        </label>
        <FormError error={create.error} />
        <div className="actions">
          <button type="submit" className="button" disabled={create.isPending}>
            Cadastrar título
          </button>
        </div>
      </form>

      <h2>Todos os títulos</h2>
      <FormError error={remove.error} />
      <QueryState query={titles} isEmpty={(data) => data.titles.length === 0} empty={<p className="state">Nenhum título cadastrado.</p>}>
        {(data) => (
          <ul aria-label="Títulos cadastrados">
            {data.titles.map((title) => (
              <li key={title.id} className="admin-row">
                <span className={title.position === 1 ? 'chip chip-win' : 'chip'}>{positionLabel(title.position)}</span>
                <span className="row-title">
                  {title.tournamentName} ({title.year})
                </span>
                <span className="muted">{title.team.name}</span>
                {title.tournamentId === null ? (
                  <ConfirmButton
                    name={`Apagar título ${title.tournamentName} (${title.year})`}
                    label="Apagar"
                    confirmLabel="Confirmar exclusão"
                    danger
                    disabled={remove.isPending}
                    onConfirm={() => remove.mutate(title.id)}
                  />
                ) : (
                  <span className="muted">Gerado pelo campeonato</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </>
  );
}
