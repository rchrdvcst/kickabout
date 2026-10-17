import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { MatchRow } from '../src/components/MatchRow';
import { Scoreboard } from '../src/components/Scoreboard';
import { TeamFields, emptyTeam } from '../src/pages/admin/team/TeamFields';
import { LEOES, TIGRES } from './data';

const tags = (container: HTMLElement) => [...container.querySelectorAll('.team-tag')].map((tag) => tag.textContent);

describe('team tag above the name', () => {
  it('shows the tag over each team name in a match row, without changing what screen readers hear', () => {
    const { container } = render(
      <MemoryRouter>
        <MatchRow to="/x" teamA={LEOES} teamB={TIGRES} scoreA={3} scoreB={1} status="completed" />
      </MemoryRouter>,
    );
    expect(tags(container)).toEqual(['LEÕ', 'TIG']);
    expect(container.querySelectorAll('.team-tag[aria-hidden="true"]')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /^Leões\s*3\s*a\s*1\s*Tigres$/ })).toBeInTheDocument();
  });

  it('puts the initial in the shield when there is no crest, since the tag is already beside it', () => {
    const { container } = render(
      <MemoryRouter>
        <MatchRow to="/x" teamA={LEOES} teamB={TIGRES} scoreA={3} scoreB={1} status="completed" />
      </MemoryRouter>,
    );
    expect([...container.querySelectorAll('.badge')].map((badge) => badge.textContent)).toEqual(['L', 'T']);
  });

  it('shows the tag over each team name on the scoreboard', () => {
    const { container } = render(<Scoreboard teamA={LEOES} teamB={TIGRES} scoreA={2} scoreB={3} />);
    expect(tags(container)).toEqual(['LEÕ', 'TIG']);
  });
});

describe('team form', () => {
  it('limits the tag to 3 characters', () => {
    render(<TeamFields value={emptyTeam} onChange={() => {}} />);
    expect(screen.getByLabelText('Tag (até 3 letras)')).toHaveAttribute('maxLength', '3');
  });
});

