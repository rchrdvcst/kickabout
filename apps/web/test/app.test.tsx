import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockApi, renderRoute } from './utils';

describe('layout', () => {
  it('shows the main navigation', async () => {
    mockApi({});
    renderRoute('/rota-que-nao-existe');
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(nav).toHaveTextContent('Campeonatos');
    expect(nav).toHaveTextContent('Times');
    expect(nav).toHaveTextContent('Títulos');
    expect(screen.getByRole('link', { name: 'Kickabout, início' })).toHaveAttribute('href', '/');
  });

  it('shows a 404 page for unknown routes', async () => {
    mockApi({});
    renderRoute('/rota-que-nao-existe');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
  });
});
