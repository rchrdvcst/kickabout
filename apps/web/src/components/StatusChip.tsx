import type { FixtureStatus } from '../api/types';

export function StatusChip({ status }: { status: FixtureStatus }) {
  if (status === 'draft') return <span className="chip chip-draft">Parcial</span>;
  if (status === 'pending') return <span className="chip">A jogar</span>;
  return <span className="chip chip-win">Encerrado</span>;
}
