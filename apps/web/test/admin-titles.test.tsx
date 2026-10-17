import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TitlesData } from '../src/api/types';
import { LEOES, SIGNED_IN, TIGRES } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

const titles: TitlesData = {
  ranking: [],
  titles: [
    { id: 'h1', position: 1, year: 2019, tournamentId: null, tournamentName: 'Liga 2019', team: LEOES },
    { id: 'g1', position: 1, year: 2026, tournamentId: 'c1', tournamentName: 'Copa Outubro', team: TIGRES },
  ],
};
const teams = [LEOES, TIGRES].map((t) => ({ ...t, playerCount: 6 }));

describe('admin titles', () => {
  it('registers a historical title', async () => {
    const fetchMock = mockApi({
      ...SIGNED_IN,
      '/titles': titles,
      '/teams': teams,
      'POST /titles': (body: object) => ({ id: 'h2', tournamentId: null, team: LEOES, ...body }),
    });
    renderRoute('/admin/titulos');
    const form = await screen.findByRole('form', { name: 'Novo título' });
    await within(form).findByRole('option', { name: 'Leões' });
    fireEvent.change(within(form).getByLabelText('Time'), { target: { value: 't1' } });
    fireEvent.change(within(form).getByLabelText('Campeonato'), { target: { value: 'Liga 2018' } });
    fireEvent.change(within(form).getByLabelText('Posição'), { target: { value: '2' } });
    fireEvent.change(within(form).getByLabelText('Ano'), { target: { value: '2018' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar título' }));
    await waitFor(() =>
      expect(sentBodies(fetchMock, 'POST /titles')).toEqual([{ teamId: 't1', tournamentName: 'Liga 2018', position: 2, year: 2018 }]),
    );
  });

  it('deletes only manual titles, after confirming', async () => {
    const fetchMock = mockApi({ ...SIGNED_IN, '/titles': titles, '/teams': teams, 'DELETE /titles/h1': { ok: true } });
    renderRoute('/admin/titulos');
    const list = await screen.findByRole('list', { name: 'Títulos cadastrados' });
    expect(within(list).getAllByRole('button', { name: /^Apagar título/ })).toHaveLength(1);
    expect(list).toHaveTextContent('Gerado pelo campeonato');
    fireEvent.click(within(list).getByRole('button', { name: 'Apagar título Liga 2019 (2019)' }));
    expect(sentBodies(fetchMock, 'DELETE /titles/h1')).toHaveLength(0);
    fireEvent.click(within(list).getByRole('button', { name: 'Confirmar exclusão' }));
    await waitFor(() => expect(sentBodies(fetchMock, 'DELETE /titles/h1')).toHaveLength(1));
  });
});
