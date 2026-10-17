import type { TeamRef } from '../api/types';

export function TeamBadge({ team, size = 'sm' }: { team: TeamRef; size?: 'sm' | 'lg' }) {
  return (
    <span className={size === 'lg' ? 'badge badge-lg' : 'badge'} aria-hidden="true">
      {team.crestUrl ? <img src={team.crestUrl} alt="" /> : team.shortName}
    </span>
  );
}
