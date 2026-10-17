import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FixtureDetail, Tournament } from '../src/api/types';
import { FALCOES, LEOES, SIGNED_IN, TIGRES } from './data';
import { mockApi, renderRoute, sentBodies, type ApiRoutes } from './utils';

const rosterA = Array.from({ length: 6 }, (_, i) => ({ id: `a${i + 1}`, name: `Ana ${i + 1}` }));
const rosterB = Array.from({ length: 6 }, (_, i) => ({ id: `b${i + 1}`, name: `Bia ${i + 1}` }));
const RESULT = 'PUT /tournaments/c1/fixtures/0/result';

const tournament = (status: Tournament['status']): Tournament => ({
  id: 'c1',
  name: 'Copa Outubro',
  format: 'single_elimination',
  status,
  options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple' },
  createdAt: '',
  startedAt: '',
  finishedAt: null,
  entries: [],
});

const fixture = (overrides: Partial<FixtureDetail> = {}): FixtureDetail => ({
  matchId: 0,
  groupNumber: 1,
  roundNumber: 1,
  number: 1,
  isKnockout: true,
  status: 'pending',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: null,
  scoreB: null,
  duels: [],
  rosterA,
  rosterB,
  ...overrides,
});

function setup(detail: FixtureDetail, extra: ApiRoutes = {}, status: Tournament['status'] = 'in_progress') {
  const fetchMock = mockApi({
    ...SIGNED_IN,
    '/tournaments/c1': tournament(status),
    '/tournaments/c1/fixtures/0': detail,
    '/tournaments/c1/fixtures': [],
    [RESULT]: (body: { mode: string }) => ({ ...detail, status: body.mode === 'final' ? 'completed' : 'draft' }),
    ...extra,
  });
  renderRoute('/admin/campeonatos/c1/jogos/0');
  return fetchMock;
}

function fillDuel(label: string, a: string, b: string, goalsA: string, goalsB: string) {
  fireEvent.change(screen.getByLabelText(`${label}: jogador de Leões`), { target: { value: a } });
  fireEvent.change(screen.getByLabelText(`${label}: gols de Leões`), { target: { value: goalsA } });
  fireEvent.change(screen.getByLabelText(`${label}: gols de Tigres`), { target: { value: goalsB } });
  fireEvent.change(screen.getByLabelText(`${label}: jogador de Tigres`), { target: { value: b } });
}

const fillRegular = (scores: [string, string][]) =>
  scores.forEach(([goalsA, goalsB], i) => fillDuel(`${i + 1}º duelo`, `a${i + 1}`, `b${i + 1}`, goalsA, goalsB));

const ready = () => screen.findByLabelText('1º duelo: jogador de Leões');
const scoreText = () => document.querySelector('.scoreboard-score')?.textContent ?? '';
const WIN_3_2: [string, string][] = [['1', '0'], ['1', '0'], ['1', '0'], ['0', '1'], ['0', '1']];

describe('result entry', () => {
  it('computes the score live and confirms the result', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillRegular(WIN_3_2);
    expect(scoreText()).toMatch(/3\s*×\s*a\s*2/);
    expect(screen.queryByLabelText('Desempate: jogador de Leões')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado' }));
    expect(await screen.findByText('Resultado confirmado.')).toBeInTheDocument();
    const [body] = sentBodies(fetchMock, RESULT) as { mode: string; duels: unknown[] }[];
    expect(body?.mode).toBe('final');
    expect(body?.duels).toHaveLength(5);
    expect(body?.duels[0]).toEqual({ order: 1, playerAId: 'a1', playerBId: 'b1', goalsA: 1, goalsB: 0 });
  });

  it('removes players already chosen from the other duels of the same team', async () => {
    setup(fixture());
    fireEvent.change(await ready(), { target: { value: 'a1' } });
    expect(within(screen.getByLabelText('2º duelo: jogador de Leões')).queryByRole('option', { name: 'Ana 1' })).toBeNull();
    expect(within(screen.getByLabelText('1º duelo: jogador de Leões')).getByRole('option', { name: 'Ana 1' })).toBeInTheDocument();
    expect(within(screen.getByLabelText('2º duelo: jogador de Tigres')).getByRole('option', { name: 'Bia 1' })).toBeInTheDocument();
  });

  it('asks for the tiebreak duel and then penalties when a knockout is tied', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillRegular([['1', '0'], ['1', '0'], ['0', '1'], ['0', '1'], ['2', '2']]);
    expect(scoreText()).toMatch(/2\s*×\s*a\s*2/);
    fillDuel('Desempate', 'a1', 'b1', '1', '1');
    fireEvent.change(screen.getByLabelText('Pênaltis de Leões'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Pênaltis de Tigres'), { target: { value: '3' } });
    expect(scoreText()).toMatch(/3\s*×\s*a\s*2/);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado' }));
    await screen.findByText('Resultado confirmado.');
    const [body] = sentBodies(fetchMock, RESULT) as { duels: unknown[] }[];
    expect(body?.duels[5]).toEqual({ order: 6, playerAId: 'a1', playerBId: 'b1', goalsA: 1, goalsB: 1, penaltiesA: 4, penaltiesB: 3 });
  });

  it('checks the rules before confirming an incomplete result', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillDuel('1º duelo', 'a1', 'b1', '1', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Para confirmar o resultado, os duelos 1 a 5 precisam estar preenchidos.');
    expect(sentBodies(fetchMock, RESULT)).toHaveLength(0);
  });

  it('saves a draft with only the complete duels', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillDuel('1º duelo', 'a1', 'b1', '2', '1');
    fireEvent.change(screen.getByLabelText('2º duelo: jogador de Leões'), { target: { value: 'a2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(await screen.findByText('Rascunho salvo.')).toBeInTheDocument();
    expect(sentBodies(fetchMock, RESULT)).toEqual([
      { mode: 'draft', duels: [{ order: 1, playerAId: 'a1', playerBId: 'b1', goalsA: 2, goalsB: 1 }] },
    ]);
  });

  it('sends a single request when confirm is clicked twice', async () => {
    const fetchMock = setup(fixture());
    await ready();
    fillRegular(WIN_3_2);
    const confirm = screen.getByRole('button', { name: 'Confirmar resultado' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await screen.findByText('Resultado confirmado.');
    expect(sentBodies(fetchMock, RESULT)).toHaveLength(1);
  });

  it('prefills a confirmed fixture and explains when a knockout correction is locked', async () => {
    const duels = [1, 2, 3, 4, 5].map((order) => ({
      order,
      playerA: rosterA[order - 1]!,
      playerB: rosterB[order - 1]!,
      goalsA: order <= 3 ? 1 : 0,
      goalsB: order <= 3 ? 0 : 1,
      penaltiesA: null,
      penaltiesB: null,
    }));
    setup(fixture({ status: 'completed', scoreA: 3, scoreB: 2, duels }), {
      '/tournaments/c1/fixtures': [
        { matchId: 2, groupNumber: 1, roundNumber: 2, number: 1, isKnockout: true, status: 'completed', teamA: LEOES, teamB: FALCOES, scoreA: 3, scoreB: 1 },
      ],
      [RESULT]: () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'RESULT_LOCKED',
              message: 'Este resultado não pode ser alterado: há confrontos seguintes com resultado lançado. Desfaça-os primeiro.',
              details: { blockingMatchIds: [2] },
            },
          }),
          { status: 409 },
        ),
    });
    expect(await ready()).toHaveValue('a1');
    expect(screen.getByLabelText('5º duelo: gols de Tigres')).toHaveValue('1');
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull();
    fireEvent.change(screen.getByLabelText('5º duelo: gols de Tigres'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar resultado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('há confrontos seguintes com resultado lançado');
    expect(await screen.findByRole('link', { name: 'Leões × Falcões' })).toHaveAttribute('href', '/admin/campeonatos/c1/jogos/2');
  });

  it('only accepts results while the tournament is in progress', async () => {
    setup(fixture(), {}, 'finished');
    expect(await screen.findByText('Só é possível lançar resultados com o campeonato em andamento.')).toBeInTheDocument();
  });

  it('offers admins a shortcut from the public fixture page', async () => {
    mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': tournament('in_progress'),
      '/tournaments/c1/bracket': { data: null },
      '/tournaments/c1/fixtures/0': fixture({ status: 'completed', scoreA: 3, scoreB: 2 }),
    });
    renderRoute('/campeonatos/c1/jogos/0');
    expect(await screen.findByRole('link', { name: 'Corrigir resultado' })).toHaveAttribute('href', '/admin/campeonatos/c1/jogos/0');
  });
});
