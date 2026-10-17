import type { TeamInput } from '../../../api/admin';

export const emptyTeam: TeamInput = { name: '', shortName: '', crestUrl: null };

export function TeamFields({ value, onChange }: { value: TeamInput; onChange: (value: TeamInput) => void }) {
  return (
    <>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={60} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Tag (até 3 letras)</span>
        <input
          required
          maxLength={3}
          value={value.shortName}
          onChange={(e) => onChange({ ...value, shortName: e.target.value.toUpperCase() })}
        />
      </label>
      <label className="field">
        <span>Endereço do escudo (opcional)</span>
        <input
          type="url"
          placeholder="https://…"
          value={value.crestUrl ?? ''}
          onChange={(e) => onChange({ ...value, crestUrl: e.target.value.trim() === '' ? null : e.target.value.trim() })}
        />
      </label>
    </>
  );
}
