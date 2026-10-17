import { useEffect, useId, useState } from 'react';
import type { BracketData } from '../api/types';
import { viewerRoundName, type ViewerRoundInfo } from '../lib/format';

declare global {
  interface Window {
    bracketsViewer: {
      render(data: unknown, config?: Record<string, unknown>): Promise<void>;
      addLocale(name: string, locale: unknown): Promise<void>;
    };
  }
}

/**
 * Nomes dos grupos em português. O brackets-viewer só traz inglês e francês e cai no inglês
 * para outros idiomas do navegador, então os textos em português substituem os do inglês.
 */
const PT_LABELS = {
  common: {
    'group-name': 'Grupo {{groupNumber}}',
    'group-name-winner-bracket': 'Chave superior',
    'group-name-loser-bracket': 'Chave inferior',
  },
};

export function BracketView({ data }: { data: BracketData }) {
  const id = `bracket-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await import('brackets-viewer/dist/brackets-viewer.min.js');
      await import('brackets-viewer/dist/brackets-viewer.min.css');
      if (cancelled) return;
      await window.bracketsViewer.addLocale('en', PT_LABELS);
      await window.bracketsViewer.render(
        { stages: data.stage, matches: data.match, matchGames: data.match_game, participants: data.participant },
        {
          selector: `#${id}`,
          clear: true,
          participantOriginPlacement: 'none',
          customRoundName: (info: ViewerRoundInfo) => viewerRoundName(info),
        },
      );
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [data, id]);

  if (failed) {
    return (
      <p className="state state-error" role="alert">
        Não foi possível desenhar a chave. Os confrontos continuam na aba Jogos.
      </p>
    );
  }
  return <div id={id} className="brackets-viewer bracket" />;
}
