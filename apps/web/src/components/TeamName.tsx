import type { TeamRef } from '../api/types';

/** Nome do time com a tag em cima. A tag é visual: leitores de tela ouvem só o nome. */
export function TeamName({ team }: { team: TeamRef }) {
  return (
    <span className="team-label">
      <span className="team-tag" aria-hidden="true">
        {team.shortName}
      </span>
      <span className="team-name">{team.name}</span>
    </span>
  );
}
