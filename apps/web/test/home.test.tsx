import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FALCOES, fixtureSummary, tournamentListItem } from './data';
import { mockApi, renderRoute } from './utils';

describe('home', () => {
  it('opens with the latest result as a big scoreboard and lists the rest', async () => {
    mockApi({
      '/fixtures/recent?limit=8': [fixtureSummary(), fixtureSummary({ matchId: 1, teamB: FALCOES, scoreA: 1, scoreB: 3 })],
      '/tournaments?status=in_progress': [tournamentListItem()],
    });
    renderRoute('/');
    const hero = await screen.findByRole('link', { name: /Leões\s*3\s*×?\s*a\s*2\s*Tigres/ });
    expect(hero).toHaveAttribute('href', '/campeonatos/c1/jogos/0');
    expect(screen.getByRole('heading', { name: 'Resultados recentes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Falcões/ })).toHaveAttribute('href', '/campeonatos/c1/jogos/1');
    expect(await screen.findByRole('link', { name: /Copa Outubro.*Eliminatória simples, 8 times/ })).toHaveAttribute('href', '/campeonatos/c1');
  });

  it('invites to browse tournaments when nothing was played yet', async () => {
    mockApi({ '/fixtures/recent?limit=8': [], '/tournaments?status=in_progress': [] });
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Nenhum resultado ainda' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver campeonatos' })).toHaveAttribute('href', '/campeonatos');
    expect(await screen.findByText('Nenhum campeonato em andamento.')).toBeInTheDocument();
  });

  it('shows the API error message instead of a blank page', async () => {
    mockApi({
      '/fixtures/recent?limit=8': new Response('<html>Bad Gateway</html>', { status: 502 }),
      '/tournaments?status=in_progress': [],
    });
    renderRoute('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor. Tente de novo em instantes.');
  });
});

describe('tournaments list', () => {
  it('filters by status through tabs and explains empty lists', async () => {
    mockApi({
      '/tournaments?status=in_progress': [tournamentListItem()],
      '/tournaments?status=finished': [],
    });
    renderRoute('/campeonatos');
    expect(await screen.findByRole('heading', { name: 'Campeonatos', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Em andamento' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('link', { name: /Copa Outubro/ })).toBeInTheDocument();

    renderRoute('/campeonatos?status=finished');
    expect(await screen.findByText('Nenhum campeonato encerrado.')).toBeInTheDocument();
  });
});
