import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('shows a Portuguese error page inside the layout when a page crashes while rendering', async () => {
    // Resposta com formato inesperado: a página quebra ao desestruturar a lista.
    mockApi({ '/fixtures/recent?limit=8': { unexpected: true }, '/tournaments?status=in_progress': [] });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Algo deu errado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });
  it('offers sign in from the footer to visitors', async () => {
    mockApi({ '/auth/me': { user: null } });
    renderRoute('/rota-que-nao-existe');
    expect(await screen.findByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(screen.queryByText(/organizador/i)).toBeNull();
  });
  it('shows the Kickabout logo as the home link', async () => {
    mockApi({});
    renderRoute('/rota-que-nao-existe');
    const home = await screen.findByRole('link', { name: 'Kickabout, início' });
    expect(home.querySelector('img')).toHaveAttribute('src', '/logo.png');
  });
});
