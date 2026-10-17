import type { TournamentInput } from '../../../api/admin';
import type { TournamentFormat, TournamentOptions } from '../../../api/types';
import { GROUP_COUNTS } from '@kickabout/shared';
import { FORMAT_LABEL, cupSummary } from '../../../lib/format';

const FORMATS: TournamentFormat[] = ['single_elimination', 'double_elimination', 'round_robin', 'cup'];

/** Nome, formato e só as opções que valem para o formato escolhido. */
export function TournamentFields({
  value,
  onChange,
  teamCount,
}: {
  value: TournamentInput;
  onChange: (value: TournamentInput) => void;
  teamCount?: number;
}) {
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
      {(value.format === 'single_elimination' || value.format === 'cup') && (
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
      {(value.format === 'round_robin' || value.format === 'cup') && (
        <label className="field">
          <span>{value.format === 'cup' ? 'Fase de grupos' : 'Turnos'}</span>
          <select
            value={value.options.roundRobinMode ?? 'simple'}
            onChange={(e) => setOption({ roundRobinMode: e.target.value as TournamentOptions['roundRobinMode'] })}
          >
            <option value="simple">Turno único</option>
            <option value="double">Ida e volta</option>
          </select>
        </label>
      )}
      {value.format === 'cup' && (
        <>
          <label className="field">
            <span>Número de grupos</span>
            <select value={value.options.groupCount ?? 2} onChange={(e) => setOption({ groupCount: Number(e.target.value) })}>
              {GROUP_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {count} grupos
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Classificados por grupo</span>
            <input
              type="number"
              min={1}
              max={63}
              required
              value={value.options.qualifiersPerGroup ?? 2}
              onChange={(e) => setOption({ qualifiersPerGroup: Number(e.target.value) })}
            />
          </label>
          <p className="muted" role="status">
            {teamCount === undefined
              ? 'Os grupos são sorteados depois da inscrição dos times.'
              : cupSummary(teamCount, value.options.groupCount ?? 2, value.options.qualifiersPerGroup ?? 2)}
          </p>
        </>
      )}
    </>
  );
}
