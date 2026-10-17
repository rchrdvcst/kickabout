import { useBracket, useTournamentFixtures } from '../../api/queries';
import type { FixtureListItem, Tournament } from '../../api/types';
import { MatchRow } from '../../components/MatchRow';
import { QueryState } from '../../components/QueryState';
import { fixtureRoundLabel } from '../../lib/format';

interface Props {
  tournament: Tournament;
  /** Endereço de cada confronto (o admin aponta para a tela de lançamento). */
  fixtureUrl?: (matchId: number) => string;
}

export function FixturesTab({ tournament, fixtureUrl = (matchId) => `/campeonatos/${tournament.id}/jogos/${matchId}` }: Props) {
  const fixtures = useTournamentFixtures(tournament.id);
  const bracket = useBracket(tournament.id);

  return (
    <QueryState
      query={fixtures}
      isEmpty={(list) => list.length === 0}
      empty={<p className="state">Nenhum confronto definido ainda.</p>}
    >
      {(list) => {
        const rounds = new Map<string, FixtureListItem[]>();
        for (const fixture of list) {
          const key = `${fixture.phase}-${fixture.groupNumber}-${fixture.roundNumber}`;
          rounds.set(key, [...(rounds.get(key) ?? []), fixture]);
        }
        return [...rounds.values()].map((round) => {
          const first = round[0]!;
          const title = fixtureRoundLabel(tournament.format, bracket.data?.data ?? null, first);
          return (
            <section key={`${first.phase}-${first.groupNumber}-${first.roundNumber}`}>
              <h2>{title}</h2>
              <ul className="list">
                {round.map((fixture) => (
                  <li key={fixture.matchId}>
                    <MatchRow
                      to={fixtureUrl(fixture.matchId)}
                      teamA={fixture.teamA}
                      teamB={fixture.teamB}
                      scoreA={fixture.scoreA}
                      scoreB={fixture.scoreB}
                      status={fixture.status}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        });
      }}
    </QueryState>
  );
}
