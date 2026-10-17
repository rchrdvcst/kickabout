import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TeamPageData } from '../src/api/types';
import { LEOES, TIGRES, fixtureSummary } from './data';
import { mockApi, renderRoute } from './utils';

const roster = [
  { id: 'p1', name: 'Ana', phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321' },
  { id: 'p2', name: 'Bia', phone: '+5521999990000', whatsappUrl: 'https://wa.me/5521999990000' },
];

const teamPage = (overrides: Partial<TeamPageData> = {}): TeamPageData => ({
  team: LEOES,
  roster,
  stats: {
    teamId: 't1',
    fixtures: { played: 3, wins: 2, draws: 0, losses: 1 },
    duels: { played: 15, wins: 8, draws: 3, losses: 4 },
    goalsFor: 20,
    goalsAgainst: 12,
    goalDiff: 8,
  },
  titles: [{ id: 'x', position: 1, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro' }],
  recentFixtures: [fixtureSummary()],
  tournaments: [{ id: 'c1', name: 'Copa Outubro', format: 'single_elimination', status: 'finished' }],
  ...overrides,
});

describe('teams', () => {
  it('lists every team with its player count', async () => {
    mockApi({ '/teams': [{ ...LEOES, playerCount: 12 }, { ...TIGRES, playerCount: 1 }] });
    renderRoute('/times');
    expect(await screen.findByRole('link', { name: /Leões.*12 jogadores/ })).toHaveAttribute('href', '/times/t1');
    expect(screen.getByRole('link', { name: /Tigres.*1 jogador$/ })).toBeInTheDocument();
  });

  it('shows the team page with numbers, titles, recent fixtures and roster', async () => {
    mockApi({ '/teams/t1': teamPage() });
    renderRoute('/times/t1');
    expect(await screen.findByRole('heading', { name: 'Leões', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver BID' })).toHaveAttribute('href', '/times/t1/bid');
    expect(screen.getByText('2-0-1')).toBeInTheDocument();
    expect(screen.getByText('8-3-4')).toBeInTheDocument();
    expect(screen.getByText('Campeão')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Leões\s*3\s*×?\s*a\s*2\s*Tigres/ })).toHaveAttribute('href', '/campeonatos/c1/jogos/0');
    expect(screen.getByRole('link', { name: 'Abrir WhatsApp de Ana' })).toHaveAttribute('href', 'https://wa.me/5511987654321');
  });

  it('shows the BID with formatted phones opening WhatsApp in a new tab', async () => {
    mockApi({ '/teams/t1/roster': { team: LEOES, players: roster } });
    renderRoute('/times/t1/bid');
    expect(await screen.findByRole('heading', { name: 'Leões', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('BID com 2 jogadores.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Abrir WhatsApp de Ana' });
    expect(link).toHaveTextContent('(11) 98765-4321');
    expect(link).toHaveAttribute('href', 'https://wa.me/5511987654321');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows only names when the API hides phones', async () => {
    mockApi({ '/teams/t1/roster': { team: LEOES, players: [{ id: 'p1', name: 'Ana' }] } });
    renderRoute('/times/t1/bid');
    const list = await screen.findByRole('list', { name: 'Jogadores do BID' });
    expect(within(list).getByRole('link', { name: 'Ana' })).toHaveAttribute('href', '/jogadores/p1');
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull();
  });

  it('explains an empty roster', async () => {
    mockApi({ '/teams/t1/roster': { team: LEOES, players: [] } });
    renderRoute('/times/t1/bid');
    expect(await screen.findByText('Nenhum jogador no elenco.')).toBeInTheDocument();
  });
});
