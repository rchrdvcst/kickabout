import type { TeamRef } from '../api/types';

interface Props {
  team: TeamRef;
  size?: 'sm' | 'lg';
  /** Sem escudo: a tag do time, ou só a inicial do nome quando a tag já aparece ao lado (TeamName). */
  mark?: 'tag' | 'initial';
}

export function TeamBadge({ team, size = 'sm', mark = 'tag' }: Props) {
  const fallback = mark === 'initial' ? (Array.from(team.name)[0] ?? '').toUpperCase() : team.shortName;
  return (
    <span className={size === 'lg' ? 'badge badge-lg' : 'badge'} aria-hidden="true">
      {team.crestUrl ? <img src={team.crestUrl} alt="" /> : fallback}
    </span>
  );
}
