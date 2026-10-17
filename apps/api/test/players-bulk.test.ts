import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPlayer, createTeam, createTestApp, loginAdmin, prisma, resetDb } from './helpers';

const app = createTestApp();
afterAll(() => app.close());
beforeEach(resetDb);

const bulk = (cookie: string, players: unknown) =>
  app.inject({ method: 'POST', url: '/api/players/bulk', headers: { cookie }, payload: { players } });

describe('admin player list order', () => {
  it('lists the most recently registered players first, also when searching', async () => {
    const cookie = await loginAdmin(app);
    await createPlayer(app, cookie, { name: 'Ana Antiga' });
    await createPlayer(app, cookie, { name: 'Bia Meio' });
    await createPlayer(app, cookie, { name: 'Ana Nova' });

    const all = await app.inject({ method: 'GET', url: '/api/players', headers: { cookie } });
    expect(all.json().map((p: { name: string }) => p.name)).toEqual(['Ana Nova', 'Bia Meio', 'Ana Antiga']);

    const search = await app.inject({ method: 'GET', url: '/api/players?search=ana', headers: { cookie } });
    expect(search.json().map((p: { name: string }) => p.name)).toEqual(['Ana Nova', 'Ana Antiga']);
  });
});

describe('bulk player registration', () => {
  it('requires login', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/players/bulk', payload: { players: [] } });
    expect(res.statusCode).toBe(401);
  });

  it('saves the valid rows and reports each failed row with its line, name and reason', async () => {
    const cookie = await loginAdmin(app);
    const leoes = await createTeam(app, cookie, 'Leões');
    await createPlayer(app, cookie, { name: 'Já Existe', phone: '+55 11 98765-4321' });

    const res = await bulk(cookie, [
      { nome: 'João Silva', celular: '+55 84 99677-3612', time: 'LEÕ' },
      { nome: 'Pedro Costa', celular: '+351 912 345 678' },
      { nome: 'Repetido', celular: '+55 84 99677-3612' },
      { nome: 'Duplicado no banco', celular: '(11) 98765-4321' },
      { nome: 'Sem time', celular: '+55 84 9677-3612', time: 'XYZ' },
      { nome: 'Pelo nome', celular: '+55 21 91234-5678', time: 'leões' },
      { nome: '', celular: '+55 21 91234-0000' },
      { nome: 'Celular ruim', celular: '123' },
      'texto solto',
    ]);

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.created.map((row: { line: number; player: { name: string } }) => [row.line, row.player.name])).toEqual([
      [1, 'João Silva'],
      [2, 'Pedro Costa'],
      [6, 'Pelo nome'],
    ]);
    expect(body.created[0].player).toMatchObject({ phone: '+5584996773612', team: { id: leoes.id } });
    expect(body.created[1].player).toMatchObject({ phone: '+351912345678', team: null });
    expect(body.failed).toEqual([
      { line: 3, name: 'Repetido', message: 'celular repetido na linha 1' },
      { line: 4, name: 'Duplicado no banco', message: 'celular já cadastrado' },
      { line: 5, name: 'Sem time', message: 'time "XYZ" não existe' },
      { line: 7, name: null, message: 'nome é obrigatório' },
      { line: 8, name: 'Celular ruim', message: 'celular inválido' },
      { line: 9, name: null, message: 'cada item precisa ter nome e celular' },
    ]);
    expect(await prisma.player.count()).toBe(4);
  });

  it('asks for the team name when a tag is shared by two teams', async () => {
    const cookie = await loginAdmin(app);
    await createTeam(app, cookie, 'Leões');
    await createTeam(app, cookie, 'Leões da Vila');
    const res = await bulk(cookie, [{ nome: 'Ana', celular: '+55 11 91111-1111', time: 'LEÕ' }]);
    expect(res.json().failed).toEqual([
      { line: 1, name: 'Ana', message: 'tag "LEÕ" é usada por mais de um time; use o nome do time' },
    ]);
  });

  it('stops adding to a team once its roster is full', async () => {
    const cookie = await loginAdmin(app);
    const team = await createTeam(app, cookie, 'Leões');
    for (let i = 0; i < 19; i++) await createPlayer(app, cookie, { teamId: team.id });
    const res = await bulk(cookie, [
      { nome: 'Vinte', celular: '+55 11 92222-0001', time: 'Leões' },
      { nome: 'Vinte e um', celular: '+55 11 92222-0002', time: 'Leões' },
    ]);
    expect(res.json().created.map((row: { line: number }) => row.line)).toEqual([1]);
    expect(res.json().failed).toEqual([{ line: 2, name: 'Vinte e um', message: 'o time já tem 20 jogadores ativos' }]);
    expect(await prisma.player.count()).toBe(20);
  });

  it('rejects a body that is not a list of up to 200 players', async () => {
    const cookie = await loginAdmin(app);
    for (const players of [{ nome: 'Ana' }, [], Array.from({ length: 201 }, (_, i) => ({ nome: `J${i}`, celular: `+55 11 9${String(i).padStart(4, '0')}-0000` }))]) {
      const res = await bulk(cookie, players);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
    }
  });
});
