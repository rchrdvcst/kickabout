import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { FixtureDetail, FixtureListItem } from '../src/api/types';
import { DuelStrip } from '../src/components/DuelStrip';
import { MatchRow } from '../src/components/MatchRow';
import { FALCOES, LEOES, SIGNED_IN, TIGRES, fixtureSummary, tournamentListItem } from './data';
import { mockApi, renderRoute } from './utils';

const listItem = (overrides: Partial<FixtureListItem> = {}): FixtureListItem => ({
  matchId: 0,
  groupNumber: 1,
  roundNumber: 1,
  number: 1,
  phase: 'knockout',
  isKnockout: true,
  status: 'pending',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: null,
  scoreB: null,
  ...overrides,
});

const duel = (order: number, goalsA: number, goalsB: number) => ({
  order,
  playerA: { id: `a${order}`, name: `Ana ${order}` },
  playerB: { id: `b${order}`, name: `Bia ${order}` },
  goalsA,
  goalsB,
  penaltiesA: null,
  penaltiesB: null,
});

const detail = (overrides: Partial<FixtureDetail> = {}): FixtureDetail => ({
  matchId: 0,
  groupNumber: 1,
  roundNumber: 1,
  number: 1,
  phase: 'knockout',
  isKnockout: true,
  status: 'completed',
  teamA: LEOES,
  teamB: TIGRES,
  scoreA: 3,
  scoreB: 2,
  duels: [duel(1, 1, 0), duel(2, 1, 0), duel(3, 0, 1), duel(4, 2, 0), duel(5, 0, 2)],
  ...overrides,
});

describe('organizer desk', () => {
  it('opens with the fixtures waiting for a result in tournaments in progress', async () => {
    mockApi({
      ...SIGNED_IN,
      '/tournaments?status=in_progress': [tournamentListItem(), tournamentListItem({ id: 'c2', name: 'Liga Nova' })],
      '/tournaments/c1/fixtures': [
        listItem({ matchId: 0, status: 'completed', scoreA: 3, scoreB: 2 }),
        listItem({ matchId: 1, status: 'draft', teamA: FALCOES }),
        listItem({ matchId: 2, status: 'pending' }),
      ],
      '/tournaments/c2/fixtures': [listItem({ matchId: 0, status: 'completed', scoreA: 1, scoreB: 0 })],
    });
    renderRoute('/admin');
    expect(await screen.findByRole('heading', { name: 'Área do organizador' })).toBeInTheDocument();
    const desk = await screen.findByRole('region', { name: 'Para lançar' });
    await within(desk).findByRole('heading', { name: 'Copa Outubro' });
    const links = within(desk).getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links.filter((href) => href?.includes('/jogos/'))).toEqual(['/admin/campeonatos/c1/jogos/1', '/admin/campeonatos/c1/jogos/2']);
    expect(within(desk).getByRole('heading', { name: 'Copa Outubro' })).toBeInTheDocument();
    expect(within(desk).queryByRole('heading', { name: 'Liga Nova' })).toBeNull();
    const records = screen.getByRole('region', { name: 'Cadastros' });
    expect(within(records).getByRole('link', { name: /Times/ })).toHaveAttribute('href', '/admin/times');
  });

  it('says when nothing is waiting for a result', async () => {
    mockApi({ ...SIGNED_IN, '/tournaments?status=in_progress': [] });
    renderRoute('/admin');
    const desk = await screen.findByRole('region', { name: 'Para lançar' });
    expect(await within(desk).findByText('Nenhum confronto esperando resultado.')).toBeInTheDocument();
  });
});

describe('organizer bar', () => {
  it('replaces the public menu inside the organizer area and links back to the site', async () => {
    mockApi({ ...SIGNED_IN, '/tournaments?status=in_progress': [] });
    renderRoute('/admin');
    expect(await screen.findByRole('navigation', { name: 'Administração' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver site' })).toHaveAttribute('href', '/');
  });
});

describe('match row without a result', () => {
  it('shows the status chip outside the score box', () => {
    const { container } = render(
      <MemoryRouter>
        <MatchRow to="/x" teamA={LEOES} teamB={TIGRES} scoreA={null} scoreB={null} status="pending" />
      </MemoryRouter>,
    );
    expect(container.querySelector('.match-score')).toBeNull();
    expect(container.querySelector('.match-status')).toHaveTextContent('A jogar');
  });
});

describe('home hero', () => {
  it('shows each duel of the latest result under the scoreboard', async () => {
    mockApi({
      '/fixtures/recent?limit=8': [fixtureSummary()],
      '/tournaments?status=in_progress': [],
      '/tournaments/c1/fixtures/0': detail(),
    });
    renderRoute('/');
    const strip = await screen.findByRole('list', { name: 'Resultado de cada duelo' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(5);
    expect(within(strip).getAllByRole('listitem')[2]).toHaveTextContent('3º duelo: Tigres venceu');
  });
});

describe('duel strip tags', () => {
  it("names the winner of each duel by the team's short name, and marks draws", () => {
    const { container } = render(
      <DuelStrip duels={detail().duels.map((d, i) => (i === 4 ? { ...d, goalsA: 1, goalsB: 1 } : d))} teamA="Leões" teamB="Tigres" tags={['LEO', 'TIG']} />,
    );
    expect([...container.querySelectorAll('.duel-seg-tag')].map((tag) => tag.textContent)).toEqual(['LEO', 'LEO', 'TIG', 'LEO', '=']);
    expect(container.querySelectorAll('.duel-seg-tag[aria-hidden="true"]')).toHaveLength(5);
  });
});

describe('duel strip colors', () => {
  it('paints in green the duels won by the winner of the match, whatever its side', () => {
    const duels = detail().duels.map((d, i) => (i < 3 ? { ...d, goalsA: 0, goalsB: 1 } : d)); // Tigres 4 × 1
    const { container } = render(<DuelStrip duels={duels} teamA="Leões" teamB="Tigres" tags={['LEO', 'TIG']} />);
    const won = [...container.querySelectorAll('.duel-seg')].map((seg) => seg.classList.contains('duel-seg-winner'));
    expect(won).toEqual([true, true, true, false, true]);
  });

  it('paints nothing in green when the match is a draw', () => {
    const goals: [number, number][] = [[1, 1], [1, 0], [0, 1], [0, 0], [2, 2]]; // 1 × 1
    const duels = detail().duels.map((d, i) => ({ ...d, goalsA: goals[i]![0], goalsB: goals[i]![1] }));
    const { container } = render(<DuelStrip duels={duels} teamA="Leões" teamB="Tigres" tags={['LEO', 'TIG']} />);
    expect(container.querySelector('.duel-seg-winner')).toBeNull();
  });
});
