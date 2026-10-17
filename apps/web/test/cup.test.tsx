import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Tournament } from '../src/api/types';
import { cupSummary } from '../src/lib/format';
import { FALCOES, LEOES, SIGNED_IN, TIGRES, team } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const ONCAS = team('t4', 'Onças');

export const cupTournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 'c1',
  name: 'Copa Verão',
  format: 'cup',
  status: 'in_progress',
  options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple', groupCount: 2, qualifiersPerGroup: 1 },
  createdAt: '',
  startedAt: '',
  finishedAt: null,
  entries: [LEOES, TIGRES, FALCOES, ONCAS].map((t, i) => ({ seed: i + 1, team: t })),
  groupDraw: null,
  knockoutDrawn: false,
  groupsPending: 3,
  ...overrides,
});

const row = (t: typeof LEOES, groupNumber: number, position: number, qualified: boolean) => ({
  position,
  teamId: t.id,
  team: t,
  groupNumber,
  qualified,
  played: 1,
  wins: position === 1 ? 1 : 0,
  draws: 0,
  losses: position === 1 ? 0 : 1,
  points: position === 1 ? 3 : 0,
  duelsWon: 3,
  duelsLost: 2,
  goalsFor: 5,
  goalsAgainst: 3,
  goalDiff: 2,
});

describe('cup public page', () => {
  it('opens on the groups tab with one table per group and marks the qualifiers', async () => {
    mockApi({
      '/tournaments/c1': cupTournament(),
      '/tournaments/c1/standings': [row(LEOES, 1, 1, true), row(TIGRES, 1, 2, false), row(FALCOES, 2, 1, true), row(ONCAS, 2, 2, false)],
    });
    renderRoute('/campeonatos/c1');
    const tabs = await screen.findByRole('navigation', { name: 'Seções do campeonato' });
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent)).toEqual(['Grupos', 'Chave', 'Jogos', 'Times', 'Estatísticas']);
    expect(within(tabs).getByRole('link', { name: 'Grupos' })).toHaveAttribute('aria-current', 'page');
    const groupA = await screen.findByRole('table', { name: 'Classificação do Grupo A' });
    const groupB = screen.getByRole('table', { name: 'Classificação do Grupo B' });
    expect(within(groupA).getAllByRole('row')[1]).toHaveClass('qualified');
    expect(within(groupA).getAllByRole('row')[2]).not.toHaveClass('qualified');
    expect(within(groupB).getByText('Falcões')).toBeInTheDocument();
    expect(screen.getByText('O primeiro de cada grupo vai para o mata-mata.')).toBeInTheDocument();
  });

  it('tells how many group matches are left before the knockout draw', async () => {
    mockApi({ '/tournaments/c1': cupTournament(), '/tournaments/c1/bracket': { data: null } });
    renderRoute('/campeonatos/c1?aba=chave');
    expect(await screen.findByText('A chave é sorteada quando a fase de grupos terminar. Faltam 3 jogos.')).toBeInTheDocument();
  });

  it('says the knockout is about to be drawn when the groups are over', async () => {
    mockApi({ '/tournaments/c1': cupTournament({ groupsPending: 0 }), '/tournaments/c1/bracket': { data: null } });
    renderRoute('/campeonatos/c1?aba=chave');
    expect(await screen.findByText('A fase de grupos terminou. A chave aparece assim que o mata-mata for sorteado.')).toBeInTheDocument();
  });

  it('labels group fixtures with the group and the round', async () => {
    mockApi({
      '/tournaments/c1': cupTournament(),
      '/tournaments/c1/bracket': { data: null },
      '/tournaments/c1/fixtures': [
        { matchId: 0, groupNumber: 2, roundNumber: 1, number: 1, phase: 'groups', isKnockout: false, status: 'pending', teamA: FALCOES, teamB: ONCAS, scoreA: null, scoreB: null },
      ],
    });
    renderRoute('/campeonatos/c1?aba=jogos');
    expect(await screen.findByRole('heading', { name: 'Grupo B, 1ª rodada' })).toBeInTheDocument();
  });
});
describe('cupSummary', () => {
  it('describes the layout or the problem', () => {
    expect(cupSummary(9, 2, 3)).toBe('9 times: grupos de 5 e 4; passam 6; mata-mata de 8 com 2 BYEs.');
    expect(cupSummary(10, 4, 1)).toBe('10 times: grupos de 3, 3, 2 e 2; passam 4; mata-mata de 4.');
    expect(cupSummary(8, 2, 2)).toBe('8 times: 2 grupos de 4; passam 4; mata-mata de 4.');
    expect(cupSummary(9, 2, 4)).toBe('Com 9 times em 2 grupos, passam no máximo 3 por grupo.');
  });
});

describe('cup admin', () => {
  it('shows the cup options when creating and sends them', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments': [],
      'POST /tournaments': cupTournament({ status: 'draft' }),
      '/tournaments/c1': cupTournament({ status: 'draft', groupsPending: null }),
      '/teams': [],
    });
    renderRoute('/admin/campeonatos');
    const form = await screen.findByRole('form', { name: 'Novo campeonato' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Copa Verão' } });
    fireEvent.change(within(form).getByLabelText('Formato'), { target: { value: 'cup' } });
    fireEvent.change(within(form).getByLabelText('Número de grupos'), { target: { value: '4' } });
    fireEvent.change(within(form).getByLabelText('Classificados por grupo'), { target: { value: '1' } });
    fireEvent.click(within(form).getByLabelText('Disputa de 3º lugar'));
    fireEvent.click(within(form).getByRole('button', { name: 'Criar campeonato' }));
    await screen.findByRole('heading', { name: 'Copa Verão' });
    expect(sentBodies(fetchMock, 'POST /tournaments')).toEqual([
      { name: 'Copa Verão', format: 'cup', options: { groupCount: 4, qualifiersPerGroup: 1, consolationFinal: true } },
    ]);
  });

  it('draws the groups in the draft and starts only with a draw', async () => {
    const draft = cupTournament({ status: 'draft', groupsPending: null });
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': draft,
      '/teams': [],
      'POST /tournaments/c1/group-draw': { groups: [[LEOES, FALCOES], [TIGRES, ONCAS]] },
    });
    renderRoute('/admin/campeonatos/c1');
    const section = await screen.findByRole('region', { name: 'Sorteio dos grupos' });
    expect(screen.getByRole('button', { name: 'Iniciar campeonato' })).toBeDisabled();
    expect(screen.getByText('Sorteie os grupos antes de iniciar.')).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: 'Sortear grupos' }));
    await screen.findByRole('region', { name: 'Sorteio dos grupos' });
    expect(sentBodies(fetchMock, 'POST /tournaments/c1/group-draw')).toHaveLength(1);
  });

  it('shows the drawn groups with a button to draw again', async () => {
    mockApi({ ...SIGNED_IN, '/tournaments/c1': cupTournament({ status: 'draft', groupsPending: null, groupDraw: [[LEOES, FALCOES], [TIGRES, ONCAS]] }), '/teams': [] });
    renderRoute('/admin/campeonatos/c1');
    const section = await screen.findByRole('region', { name: 'Sorteio dos grupos' });
    expect(within(section).getByRole('heading', { name: 'Grupo A' })).toBeInTheDocument();
    expect(within(section).getByText('Falcões')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Sortear de novo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar campeonato' })).toBeEnabled();
  });

  const inProgress = { ...SIGNED_IN, '/tournaments/c1/fixtures': [], '/tournaments/c1/bracket': { data: null } };

  it('waits for the groups before offering the knockout draw, and hides the finish button', async () => {
    mockApi({ ...inProgress, '/tournaments/c1': cupTournament() });
    renderRoute('/admin/campeonatos/c1');
    const waiting = await screen.findByRole('region', { name: 'Mata-mata' });
    expect(within(waiting).getByText('O sorteio do mata-mata fica disponível quando a fase de grupos terminar. Faltam 3 jogos.')).toBeInTheDocument();
    expect(within(waiting).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Encerrar campeonato' })).toBeNull();
  });

  it('draws the knockout when the groups are over', async () => {
    const fetchMock = mockApi({
      ...inProgress,
      '/tournaments/c1': cupTournament({ groupsPending: 0 }),
      'POST /tournaments/c1/knockout-draw': cupTournament({ groupsPending: 0, knockoutDrawn: true }),
    });
    renderRoute('/admin/campeonatos/c1');
    const ready = await screen.findByRole('region', { name: 'Mata-mata' });
    fireEvent.click(within(ready).getByRole('button', { name: 'Sortear mata-mata' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'POST /tournaments/c1/knockout-draw')).toHaveLength(1));
  });

  it('offers redraw, undo and finish once the knockout is drawn', async () => {
    mockApi({ ...inProgress, '/tournaments/c1': cupTournament({ groupsPending: 0, knockoutDrawn: true }) });
    renderRoute('/admin/campeonatos/c1');
    const drawn = await screen.findByRole('region', { name: 'Mata-mata' });
    expect(within(drawn).getByRole('button', { name: 'Sortear de novo' })).toBeInTheDocument();
    expect(within(drawn).getByRole('button', { name: 'Desfazer sorteio do mata-mata' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encerrar campeonato' })).toBeInTheDocument();
  });
});

describe('cup draft with unsaved settings', () => {
  it('blocks the group draw and the start until the settings are saved', async () => {
    const saved = cupTournament({
      status: 'draft',
      groupsPending: null,
      options: { consolationFinal: false, grandFinalReset: false, roundRobinMode: 'simple', groupCount: 4, qualifiersPerGroup: 2 },
    });
    mockApi({ ...SIGNED_IN, '/tournaments/c1': saved, '/teams': [] });
    renderRoute('/admin/campeonatos/c1');
    const settings = await screen.findByRole('form', { name: 'Configuração' });
    const draw = await screen.findByRole('region', { name: 'Sorteio dos grupos' });
    expect(within(draw).getByRole('button', { name: 'Sortear grupos' })).toBeEnabled();

    fireEvent.change(within(settings).getByLabelText('Número de grupos'), { target: { value: '2' } });
    expect(within(draw).getByRole('button', { name: 'Sortear grupos' })).toBeDisabled();
    expect(screen.getByText('Salve a configuração antes de sortear os grupos.')).toBeInTheDocument();

    fireEvent.change(within(settings).getByLabelText('Número de grupos'), { target: { value: '4' } });
    expect(within(draw).getByRole('button', { name: 'Sortear grupos' })).toBeEnabled();
  });
});

describe('draft with unsaved settings in other formats', () => {
  it('explains why the start waits for the settings', async () => {
    mockApi({
      ...SIGNED_IN,
      '/tournaments/c1': cupTournament({ status: 'draft', format: 'single_elimination', groupsPending: undefined, knockoutDrawn: undefined, groupDraw: undefined }),
      '/teams': [],
    });
    renderRoute('/admin/campeonatos/c1');
    const settings = await screen.findByRole('form', { name: 'Configuração' });
    fireEvent.click(within(settings).getByLabelText('Disputa de 3º lugar'));
    expect(screen.getByText('Salve a configuração antes de iniciar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar campeonato' })).toBeDisabled();
  });
});
