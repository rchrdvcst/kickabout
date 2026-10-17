import { Link } from 'react-router';
import type { RosterPlayer } from '../api/types';
import { formatPhone } from '../lib/format';

export function RosterList({ players }: { players: RosterPlayer[] }) {
  if (players.length === 0) return <p className="state">Nenhum jogador no elenco.</p>;
  return (
    <ul className="roster" aria-label="Jogadores do BID">
      {players.map((player) => (
        <li key={player.id}>
          <Link to={`/jogadores/${player.id}`} className="roster-name">
            {player.name}
          </Link>
          {player.phone && player.whatsappUrl && (
            <a
              href={player.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="roster-phone"
              aria-label={`Abrir WhatsApp de ${player.name}`}
            >
              {formatPhone(player.phone)}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
