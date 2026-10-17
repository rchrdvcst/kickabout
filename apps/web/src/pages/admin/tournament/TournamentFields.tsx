import type { TournamentInput } from '../../../api/admin';
import type { TournamentFormat, TournamentOptions } from '../../../api/types';
import { FORMAT_LABEL } from '../../../lib/format';

const FORMATS: TournamentFormat[] = ['single_elimination', 'double_elimination', 'round_robin'];

/** Nome, formato e só as opções que valem para o formato escolhido. */
export function TournamentFields({ value, onChange }: { value: TournamentInput; onChange: (value: TournamentInput) => void }) {
  const set = (patch: Partial<TournamentInput>) => onChange({ ...value, ...patch });
  const setOption = (patch: Partial<TournamentOptions>) => set({ options: { ...value.options, ...patch } });

  return (
    <>
      <label className="field">
        <span>Nome</span>
        <input required maxLength={80} value={value.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>Formato</span>
        <select value={value.format} onChange={(e) => set({ format: e.target.value as TournamentFormat })}>
          {FORMATS.map((format) => (
            <option key={format} value={format}>
              {FORMAT_LABEL[format]}
            </option>
          ))}
        </select>
      </label>
      {value.format === 'single_elimination' && (
        <label className="check">
          <input
            type="checkbox"
            checked={value.options.consolationFinal ?? false}
            onChange={(e) => setOption({ consolationFinal: e.target.checked })}
          />
          <span>Disputa de 3º lugar</span>
        </label>
      )}
      {value.format === 'double_elimination' && (
        <label className="check">
          <input
            type="checkbox"
            checked={value.options.grandFinalReset ?? false}
            onChange={(e) => setOption({ grandFinalReset: e.target.checked })}
          />
          <span>Final com reset (quem vem da chave inferior precisa vencer duas vezes)</span>
        </label>
      )}
      {value.format === 'round_robin' && (
        <label className="field">
          <span>Turnos</span>
          <select
            value={value.options.roundRobinMode ?? 'simple'}
            onChange={(e) => setOption({ roundRobinMode: e.target.value as TournamentOptions['roundRobinMode'] })}
          >
            <option value="simple">Turno único</option>
            <option value="double">Ida e volta</option>
          </select>
        </label>
      )}
    </>
  );
}
