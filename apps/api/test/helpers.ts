import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import type { AppConfig } from '../src/config';
import { hashPassword } from '../src/auth/password';

export const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    databaseUrl: process.env.DATABASE_URL ?? '',
    phoneVisibility: 'public',
    sessionTtlDays: 30,
    secureCookies: false,
    ...overrides,
  };
}

export function createTestApp(overrides: Partial<AppConfig> = {}): FastifyInstance {
  return buildApp({ prisma, config: testConfig(overrides) });
}

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Duel", "Fixture", "Title", "TournamentEntry", "Tournament", "TeamMembership", "Player", "Team", "Session", "User" CASCADE',
  );
}

export const ADMIN = { email: 'admin@kickabout.test', password: 'senha-forte-123' };

export async function loginAdmin(app: FastifyInstance): Promise<string> {
  await prisma.user.upsert({
    where: { email: ADMIN.email },
    create: { email: ADMIN.email, passwordHash: await hashPassword(ADMIN.password) },
    update: {},
  });
  const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: ADMIN });
  const cookie = res.cookies.find((c) => c.name === 'kb_session');
  if (!cookie) throw new Error(`login falhou: ${res.statusCode} ${res.body}`);
  return `kb_session=${cookie.value}`;
}

let phoneCounter = 0;
export const nextPhone = () => `11 9${String(++phoneCounter).padStart(8, '0')}`;

export interface TestTeam {
  id: string;
  name: string;
}
export interface TestPlayer {
  id: string;
  name: string;
}

export async function createTeam(app: FastifyInstance, cookie: string, name: string): Promise<TestTeam> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/teams',
    headers: { cookie },
    payload: { name, shortName: name.slice(0, 3).toUpperCase() },
  });
  if (res.statusCode !== 201) throw new Error(`createTeam: ${res.statusCode} ${res.body}`);
  return res.json();
}

export async function createPlayer(
  app: FastifyInstance,
  cookie: string,
  data: { name?: string; phone?: string; teamId?: string | null } = {},
): Promise<TestPlayer & { phone: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/players',
    headers: { cookie },
    payload: { name: data.name ?? `Jogador ${phoneCounter + 1}`, phone: data.phone ?? nextPhone(), teamId: data.teamId },
  });
  if (res.statusCode !== 201) throw new Error(`createPlayer: ${res.statusCode} ${res.body}`);
  return res.json();
}

export async function createTeamWithPlayers(app: FastifyInstance, cookie: string, name: string, count = 6) {
  const team = await createTeam(app, cookie, name);
  const players: TestPlayer[] = [];
  for (let i = 1; i <= count; i++) players.push(await createPlayer(app, cookie, { name: `${name} ${i}`, teamId: team.id }));
  return { team, players };
}

export async function createStartedTournament(
  app: FastifyInstance,
  cookie: string,
  input: { format: 'single_elimination' | 'double_elimination' | 'round_robin'; teams: TestTeam[]; options?: Record<string, unknown>; name?: string },
) {
  const created = await app.inject({
    method: 'POST',
    url: '/api/tournaments',
    headers: { cookie },
    payload: { name: input.name ?? 'Copa Teste', format: input.format, options: input.options },
  });
  if (created.statusCode !== 201) throw new Error(`create tournament: ${created.body}`);
  const { id } = created.json();
  await app.inject({
    method: 'PUT',
    url: `/api/tournaments/${id}/entries`,
    headers: { cookie },
    payload: { teamIds: input.teams.map((team) => team.id) },
  });
  const started = await app.inject({ method: 'POST', url: `/api/tournaments/${id}/start`, headers: { cookie } });
  if (started.statusCode !== 200) throw new Error(`start tournament: ${started.body}`);
  return started.json() as { id: string; format: string; status: string };
}

/** results[i] = [golsA, golsB, pênaltisA?, pênaltisB?]; duelo i usa players[i] (6º duelo usa players[0]). */
export function duelsPayload(playersA: TestPlayer[], playersB: TestPlayer[], results: [number, number, number?, number?][]) {
  return results.map(([goalsA, goalsB, penaltiesA, penaltiesB], i) => ({
    order: i + 1,
    playerAId: (i < 5 ? playersA[i] : playersA[0])!.id,
    playerBId: (i < 5 ? playersB[i] : playersB[0])!.id,
    goalsA,
    goalsB,
    penaltiesA: penaltiesA ?? null,
    penaltiesB: penaltiesB ?? null,
  }));
}

export interface TestFixture {
  matchId: number;
  groupNumber: number;
  roundNumber: number;
  status: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  scoreA: number | null;
  scoreB: number | null;
}

export async function fixtures(app: FastifyInstance, tournamentId: string): Promise<TestFixture[]> {
  return (await app.inject({ method: 'GET', url: `/api/tournaments/${tournamentId}/fixtures` })).json();
}

export function saveResult(
  app: FastifyInstance,
  cookie: string,
  tournamentId: string,
  matchId: number,
  mode: 'draft' | 'final',
  duels: unknown[],
) {
  return app.inject({
    method: 'PUT',
    url: `/api/tournaments/${tournamentId}/fixtures/${matchId}/result`,
    headers: { cookie },
    payload: { mode, duels },
  });
}

export const A_WINS_3_1: [number, number][] = [[2, 0], [1, 0], [0, 1], [3, 1], [1, 1]];
export const B_WINS_3_1: [number, number][] = [[0, 2], [0, 1], [1, 0], [1, 3], [1, 1]];
export const TIED_2_2: [number, number][] = [[1, 0], [1, 0], [0, 1], [0, 2], [2, 2]];
