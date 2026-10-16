import { describe, expect, it } from 'vitest';
import { managerFor } from '../src/tournaments/bracket-store';
import { MATCH_STATUS, isStageComplete, laterCompletedMatchIds, listMatches } from '../src/tournaments/bracket-view';
import { normalizeOptions } from '../src/tournaments/options';
import { stageInput } from '../src/tournaments/stage';

async function seBracket(teams: number, consolationFinal = false) {
  const manager = await managerFor(null);
  await manager.create.stage(
    stageInput({
      id: 'x',
      name: 'Copa',
      format: 'single_elimination',
      options: normalizeOptions({ consolationFinal }),
      entries: Array.from({ length: teams }, (_, i) => ({ team: { id: `t${i}`, name: `Time ${i}` } })),
    }),
  );
  return manager;
}

const winA = { opponent1: { score: 3, result: 'win' as const }, opponent2: { score: 1 } };

describe('bracket view', () => {
  it('lists only matches with both teams known and maps them to team ids', async () => {
    const manager = await seBracket(3);
    const data = await manager.export();
    const matches = listMatches(data);
    // 3 times numa chave de 4: um BYE, logo só 1 confronto jogável na 1ª rodada.
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ roundNumber: 1, status: MATCH_STATUS.Ready, scoreA: null, scoreB: null });
    expect([matches[0]!.teamAId, matches[0]!.teamBId].sort()).toEqual(['t1', 't2']);
  });

  it('detects completion ignoring bye matches', async () => {
    const manager = await seBracket(3);
    let data = await manager.export();
    expect(isStageComplete(data)).toBe(false);
    for (let i = 0; i < 5; i++) {
      const ready = listMatches(await manager.export()).find((m) => m.status === MATCH_STATUS.Ready);
      if (!ready) break;
      await manager.update.match({ id: ready.matchId, ...winA });
    }
    data = await manager.export();
    expect(isStageComplete(data)).toBe(true);
  });

  it('lists later completed matches that block an edit', async () => {
    const manager = await seBracket(4);
    const [semi1, semi2] = listMatches(await manager.export());
    await manager.update.match({ id: semi1!.matchId, ...winA });
    await manager.update.match({ id: semi2!.matchId, ...winA });
    const final = listMatches(await manager.export()).find((m) => m.roundNumber === 2)!;
    await manager.update.match({ id: final.matchId, ...winA });
    expect(laterCompletedMatchIds(await manager.export(), semi1!.matchId)).toEqual([final.matchId]);
  });
});
