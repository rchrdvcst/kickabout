/** Números de grupos aceitos na copa: potências de 2. */
export const GROUP_COUNTS: readonly number[] = [2, 4, 8, 16, 32, 64];

export type CupLayout = { ok: true; sizes: number[]; maxQualifiers: number } | { ok: false; message: string };

/** Tamanhos dos grupos (o mais parelho possível, maiores primeiro) e o máximo de classificados por grupo. */
export function cupLayout(teamCount: number, groupCount: number): CupLayout {
  if (!GROUP_COUNTS.includes(groupCount)) return { ok: false, message: 'O número de grupos precisa ser 2, 4, 8, 16, 32 ou 64.' };
  if (teamCount < 4) return { ok: false, message: `A copa precisa de pelo menos 4 times; há ${teamCount}.` };
  if (groupCount * 2 > teamCount) {
    const maxGroups = Math.max(...GROUP_COUNTS.filter((count) => count * 2 <= teamCount));
    return { ok: false, message: `Com ${teamCount} times, dá para ter no máximo ${maxGroups} grupos.` };
  }
  const base = Math.floor(teamCount / groupCount);
  const extra = teamCount % groupCount;
  const sizes = Array.from({ length: groupCount }, (_, index) => base + (index < extra ? 1 : 0));
  return { ok: true, sizes, maxQualifiers: base - 1 };
}

/** O que impede a copa de começar com essas opções, ou null. */
export function cupProblem(teamCount: number, groupCount: number, qualifiersPerGroup: number): string | null {
  const layout = cupLayout(teamCount, groupCount);
  if (!layout.ok) return layout.message;
  if (qualifiersPerGroup < 1) return 'Pelo menos 1 time por grupo precisa se classificar.';
  if (qualifiersPerGroup > layout.maxQualifiers) {
    return `Com ${teamCount} times em ${groupCount} grupos, passam no máximo ${layout.maxQualifiers} por grupo.`;
  }
  return null;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Sorteia os itens nos grupos, na ordem de tamanhos de `cupLayout`. */
export function drawGroups<T>(items: readonly T[], groupCount: number, random: () => number): T[][] {
  const layout = cupLayout(items.length, groupCount);
  if (!layout.ok) throw new Error(layout.message);
  const shuffled = shuffle(items, random);
  const groups: T[][] = [];
  let at = 0;
  for (const size of layout.sizes) {
    groups.push(shuffled.slice(at, at + size));
    at += size;
  }
  return groups;
}

export interface Qualified<T> {
  item: T;
  group: number;
}

/** Tira um item do grupo com mais itens restantes (empate decidido no sorteio). */
function takeFromLargest<T>(pool: Map<number, Qualified<T>[]>, random: () => number, except?: number): Qualified<T> {
  const candidates = [...pool.entries()].filter(([group, list]) => list.length > 0 && group !== except);
  const most = Math.max(...candidates.map(([, list]) => list.length));
  const tied = candidates.filter(([, list]) => list.length === most);
  const [group, list] = tied[Math.floor(random() * tied.length)]!;
  const index = Math.floor(random() * list.length);
  const [taken] = list.splice(index, 1);
  if (list.length === 0) pool.delete(group);
  return taken!;
}

/**
 * Sorteia a chave do mata-mata. Devolve as posições da chave: (0,1), (2,3)… são os confrontos da 1ª rodada,
 * `null` é BYE. Nenhum confronto da 1ª rodada junta dois times do mesmo grupo.
 *
 * Os BYEs saem sempre do grupo com mais times restantes, e cada confronto junta o grupo maior com o segundo
 * maior. Assim nenhum grupo passa da metade dos restantes, e o sorteio sempre termina (com 2+ grupos e o mesmo
 * número de classificados por grupo).
 */
export function drawKnockout<T>(qualified: readonly Qualified<T>[], random: () => number): (T | null)[] {
  if (qualified.length < 2) throw new Error('São necessários pelo menos 2 classificados.');
  let size = 1;
  while (size < qualified.length) size *= 2;

  const pool = new Map<number, Qualified<T>[]>();
  for (const entry of shuffle(qualified, random)) pool.set(entry.group, [...(pool.get(entry.group) ?? []), entry]);

  const pairs: [T, T | null][] = [];
  for (let bye = 0; bye < size - qualified.length; bye++) pairs.push([takeFromLargest(pool, random).item, null]);
  while (pool.size > 0) {
    const first = takeFromLargest(pool, random);
    if (pool.size === 0 || (pool.size === 1 && pool.has(first.group))) {
      throw new Error('Não foi possível sortear o mata-mata sem confronto do mesmo grupo.');
    }
    const second = takeFromLargest(pool, random, first.group);
    pairs.push([first.item, second.item]);
  }
  return shuffle(pairs, random).flatMap(([a, b]) => (random() < 0.5 || b === null ? [a, b] : [b, a]));
}
