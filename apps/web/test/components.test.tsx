import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DuelStrip } from '../src/components/DuelStrip';
import { MatchRow } from '../src/components/MatchRow';
import { TeamBadge } from '../src/components/TeamBadge';
import { LEOES, TIGRES, team } from './data';

const duel = (order: number, goalsA: number, goalsB: number, penaltiesA: number | null = null, penaltiesB: number | null = null) => ({
  order,
  playerA: { id: `a${order}`, name: `A${order}` },
  playerB: { id: `b${order}`, name: `B${order}` },
  goalsA,
  goalsB,
  penaltiesA,
  penaltiesB,
});

describe('DuelStrip', () => {
  it('renders one segment per duel colored by the winner, with accessible labels', () => {
    render(
      <DuelStrip
        teamA="Leões"
        teamB="Tigres"
        duels={[duel(1, 2, 0), duel(2, 0, 1), duel(3, 1, 1), duel(4, 0, 0), duel(5, 3, 3), duel(6, 1, 1, 4, 5)]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.className)).toEqual([
      'duel-seg duel-seg-a',
      'duel-seg duel-seg-b',
      'duel-seg duel-seg-draw',
      'duel-seg duel-seg-draw',
      'duel-seg duel-seg-draw',
      'duel-seg duel-seg-b duel-seg-tiebreak',
    ]);
    expect(items[0]).toHaveTextContent('1º duelo: Leões venceu');
    expect(items[2]).toHaveTextContent('3º duelo: empate');
    expect(items[5]).toHaveTextContent('Desempate: Tigres venceu');
  });
});

describe('TeamBadge', () => {
  it('uses the crest when present and the short name otherwise', () => {
    const { container, rerender } = render(<TeamBadge team={team('x', 'Leões', 'https://example.com/l.png')} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/l.png');
    rerender(<TeamBadge team={LEOES} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('LEÕ')).toBeInTheDocument();
  });
});

describe('MatchRow', () => {
  it('shows the score for completed matches and a chip otherwise', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MatchRow to="/x" teamA={LEOES} teamB={TIGRES} scoreA={3} scoreB={1} status="completed" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Leões\s*3\s*a\s*1\s*Tigres/ })).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <MatchRow to="/x" teamA={LEOES} teamB={TIGRES} scoreA={null} scoreB={null} status="pending" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveTextContent('A jogar');
  });
});
