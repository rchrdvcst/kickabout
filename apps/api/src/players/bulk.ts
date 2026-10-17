import { MAX_ACTIVE_ROSTER, normalizePhone } from '@kickabout/shared';
import type { PrismaClient, Team } from '@prisma/client';
import { AppError, isUniqueViolation } from '../errors';
import { setPlayerTeam } from './roster';

export interface BulkFailure {
  line: number;
  name: string | null;
  message: string;
}

export interface BulkResult {
  created: { line: number; id: string }[];
  failed: BulkFailure[];
}

interface BulkRow {
  nome?: unknown;
  celular?: unknown;
  time?: unknown;
}

const isRow = (value: unknown): value is BulkRow => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Time pelo nome (sem diferenciar maiúsculas) ou pela tag; tag repetida em dois times pede o nome. */
function findTeam(teams: Team[], ref: string): Team | string {
  const lower = ref.toLocaleLowerCase('pt-BR');
  const byName = teams.find((team) => team.name.toLocaleLowerCase('pt-BR') === lower);
  if (byName) return byName;
  const byTag = teams.filter((team) => team.shortName === ref.toLocaleUpperCase('pt-BR'));
  if (byTag.length === 1) return byTag[0]!;
  if (byTag.length > 1) return `tag "${ref}" é usada por mais de um time; use o nome do time`;
  return `time "${ref}" não existe`;
}

/**
 * Cadastra jogadores um a um (cada um na própria transação), com as regras do cadastro individual.
 * Salva os válidos e devolve, para os demais, a linha (1 = primeiro item), o nome e o motivo.
 */
export async function bulkRegister(prisma: PrismaClient, rows: unknown[]): Promise<BulkResult> {
  const teams = await prisma.team.findMany();
  const seenPhones = new Map<string, number>();
  const result: BulkResult = { created: [], failed: [] };

  for (const [index, row] of rows.entries()) {
    const line = index + 1;
    if (!isRow(row)) {
      result.failed.push({ line, name: null, message: 'cada item precisa ter nome e celular' });
      continue;
    }
    const name = text(row.nome);
    const fail = (message: string) => result.failed.push({ line, name: name || null, message });

    if (!name) {
      fail('nome é obrigatório');
      continue;
    }
    if (name.length > 60) {
      fail('nome com mais de 60 caracteres');
      continue;
    }
    const rawPhone = text(row.celular);
    if (!rawPhone) {
      fail('celular é obrigatório');
      continue;
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      fail('celular inválido');
      continue;
    }
    const repeated = seenPhones.get(phone);
    if (repeated) {
      fail(`celular repetido na linha ${repeated}`);
      continue;
    }
    seenPhones.set(phone, line);

    const teamRef = text(row.time);
    let team: Team | null = null;
    if (teamRef) {
      const found = findTeam(teams, teamRef);
      if (typeof found === 'string') {
        fail(found);
        continue;
      }
      team = found;
    }

    try {
      const id = await prisma.$transaction(async (tx) => {
        const player = await tx.player.create({ data: { name, phone } });
        if (team) await setPlayerTeam(tx, player.id, team.id);
        return player.id;
      });
      result.created.push({ line, id });
    } catch (error) {
      if (isUniqueViolation(error)) fail('celular já cadastrado');
      else if (error instanceof AppError && error.code === 'ROSTER_FULL') fail(`o time já tem ${MAX_ACTIVE_ROSTER} jogadores ativos`);
      else throw error;
    }
  }
  return result;
}
