import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PhoneField } from '../src/components/PhoneField';
import { LEOES, SIGNED_IN } from './data';
import { mockApi, renderRoute, sentBodies } from './utils';

/** Renderiza o campo e guarda o último valor (E.164) entregue ao formulário. */
function renderPhone(initial = '') {
  const sent: string[] = [];
  function Host() {
    const [value, setValue] = useState(initial);
    return (
      <PhoneField
        label="Celular"
        value={value}
        onChange={(next) => {
          sent.push(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Host />);
  return { sent, input: screen.getByLabelText('Celular') as HTMLInputElement, country: screen.getByLabelText('País do celular') as HTMLSelectElement };
}

describe('phone field', () => {
  it('starts in Brazil and masks while typing, sending the international number', () => {
    const { sent, input, country } = renderPhone();
    expect(country.value).toBe('BR');
    fireEvent.change(input, { target: { value: '84996773612' } });
    expect(input.value).toBe('(84) 99677-3612');
    expect(sent.at(-1)).toBe('+5584996773612');
  });

  it('accepts a Brazilian number with 8 digits after the area code', () => {
    const { sent, input } = renderPhone();
    fireEvent.change(input, { target: { value: '8496773612' } });
    fireEvent.blur(input);
    expect(input.value).toBe('(84) 9677-3612');
    expect(sent.at(-1)).toBe('+558496773612');
    expect(screen.queryByText(/inválido/)).toBeNull();
  });

  it('uses the mask of the chosen country', () => {
    const { sent, input, country } = renderPhone();
    fireEvent.change(country, { target: { value: 'PT' } });
    fireEvent.change(input, { target: { value: '912345678' } });
    expect(input.value).toBe('912 345 678');
    expect(sent.at(-1)).toBe('+351912345678');
  });

  it('switches the country when a number with + and country code is pasted', () => {
    const { sent, input, country } = renderPhone();
    fireEvent.change(input, { target: { value: '+351 912 345 678' } });
    expect(country.value).toBe('PT');
    expect(input.value).toBe('912 345 678');
    expect(sent.at(-1)).toBe('+351912345678');
  });

  it('tells when the number cannot exist in the chosen country, after leaving the field', () => {
    const { input } = renderPhone();
    fireEvent.change(input, { target: { value: '8499' } });
    expect(screen.queryByText(/inválido/)).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByText('Número inválido para Brasil.')).toBeInTheDocument();
    expect(input).toBeInvalid();
  });

  it('splits a saved number back into country and national number', () => {
    const { input, country } = renderPhone('+351912345678');
    expect(country.value).toBe('PT');
    expect(input.value).toBe('912 345 678');
  });
});

describe('bulk player registration', () => {
  const routes = { ...SIGNED_IN, '/players': [], '/teams': [{ ...LEOES, playerCount: 0 }] };

  it('sends the pasted list and shows how many were saved and which failed', async () => {
    const fetchMock = mockApi({
      ...routes,
      'POST /players/bulk': {
        created: [{ line: 1, player: { id: 'p9', name: 'João', phone: '+5584996773612', whatsappUrl: '', team: LEOES } }],
        failed: [{ line: 2, name: 'Pedro', message: 'celular já cadastrado' }],
      },
    });
    renderRoute('/admin/jogadores');
    const form = await screen.findByRole('form', { name: 'Cadastrar em massa' });
    const list = [
      { nome: 'João', celular: '+55 84 99677-3612', time: 'LEÕ' },
      { nome: 'Pedro', celular: '+55 11 98765-4321' },
    ];
    fireEvent.change(within(form).getByLabelText('JSON dos jogadores'), { target: { value: JSON.stringify(list) } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar jogadores' }));

    expect(await within(form).findByRole('status')).toHaveTextContent('1 jogador cadastrado.');
    const failures = within(form).getByRole('list', { name: 'Cadastros que falharam' });
    expect(within(failures).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Linha 2 (Pedro): celular já cadastrado']);
    expect(sentBodies(fetchMock, 'POST /players/bulk')).toEqual([{ players: list }]);
  });

  it('explains a malformed JSON without calling the server', async () => {
    const fetchMock = mockApi(routes);
    renderRoute('/admin/jogadores');
    const form = await screen.findByRole('form', { name: 'Cadastrar em massa' });
    fireEvent.change(within(form).getByLabelText('JSON dos jogadores'), { target: { value: '[{ "nome": "João" ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar jogadores' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('O texto não é um JSON válido.');

    fireEvent.change(within(form).getByLabelText('JSON dos jogadores'), { target: { value: '{ "nome": "João" }' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Cadastrar jogadores' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('O JSON precisa ser uma lista de jogadores');
    expect(sentBodies(fetchMock, 'POST /players/bulk')).toEqual([]);
  });

  it('loads the list from a .json file', async () => {
    mockApi(routes);
    renderRoute('/admin/jogadores');
    const form = await screen.findByRole('form', { name: 'Cadastrar em massa' });
    const file = new File(['[{"nome":"Ana","celular":"+55 11 91111-1111"}]'], 'jogadores.json', { type: 'application/json' });
    fireEvent.change(within(form).getByLabelText('Ou escolha um arquivo .json'), { target: { files: [file] } });
    await waitFor(() =>
      expect(within(form).getByLabelText('JSON dos jogadores')).toHaveValue('[{"nome":"Ana","celular":"+55 11 91111-1111"}]'),
    );
  });
});
