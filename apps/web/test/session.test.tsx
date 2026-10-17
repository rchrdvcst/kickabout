import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client';
import { shouldRetry } from '../src/api/query-client';
import type { AdminPlayer } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES } from './data';
import { mockApi, renderRoute } from './utils';

const failure = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ error: { code, message } }), { status });

describe('session and cache', () => {
  it('does not retry client errors', () => {
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', 'Time não encontrado.'))).toBe(false);
    expect(shouldRetry(0, new ApiError(502, 'HTTP_ERROR', '…'))).toBe(true);
    expect(shouldRetry(1, new ApiError(502, 'HTTP_ERROR', '…'))).toBe(false);
  });

  it('goes to the login page when a read-only admin page finds the session expired', async () => {
    mockApi({ ...SIGNED_IN, '/teams': [], '/players': () => failure(401, 'UNAUTHENTICATED', 'Faça login para continuar.') });
    const { router } = renderRoute('/admin/jogadores');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?voltar=%2Fadmin%2Fjogadores');
  });

  it('tells when signing out fails', async () => {
    mockApi({ ...SIGNED_IN, '/tournaments?status=in_progress': [], 'POST /auth/logout': () => failure(500, 'INTERNAL', 'Erro interno.') });
    const { router } = renderRoute('/admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno.');
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('refreshes the list even when the second step of an edit fails', async () => {
    let name = 'Ana';
    const player = (): AdminPlayer => ({ id: 'p1', name, phone: '+5511987654321', whatsappUrl: 'https://wa.me/5511987654321', team: LEOES });
    mockApi({
      ...SIGNED_IN,
      '/players': () => [player()],
      '/teams': [
        { ...LEOES, playerCount: 1 },
        { ...TIGRES, playerCount: 20 },
      ],
      'PATCH /players/p1': (body: { name: string }) => {
        name = body.name;
        return player();
      },
      'PUT /players/p1/team': () => failure(409, 'ROSTER_FULL', 'O time já tem 20 jogadores ativos.'),
    });
    renderRoute('/admin/jogadores');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Ana' }));
    const form = screen.getByRole('form', { name: 'Editar Ana' });
    await within(form).findByRole('option', { name: 'Tigres' });
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Ana Paula' } });
    fireEvent.change(within(form).getByLabelText('Time'), { target: { value: 't2' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('O time já tem 20 jogadores ativos.');
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('button', { name: 'Editar Ana Paula' })).toBeInTheDocument();
  });
});
