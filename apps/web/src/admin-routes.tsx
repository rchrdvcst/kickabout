import type { RouteObject } from 'react-router';
import { AdminHome } from './pages/admin/AdminHome';
import { NotFoundPage } from './pages/NotFoundPage';
import { AdminTeamsPage } from './pages/admin/AdminTeamsPage';
import { AdminTeamPage } from './pages/admin/AdminTeamPage';
import { AdminPlayersPage } from './pages/admin/AdminPlayersPage';
import { AdminTournamentsPage } from './pages/admin/AdminTournamentsPage';
import { AdminTournamentPage } from './pages/admin/AdminTournamentPage';
import { AdminFixturePage } from './pages/admin/AdminFixturePage';
import { AdminTitlesPage } from './pages/admin/AdminTitlesPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';

/** Filhos de `/admin` (todos exigem um organizador). Cada task acrescenta as suas rotas antes do `*`. */
export const adminRoutes: RouteObject[] = [
  { index: true, element: <AdminHome /> },
  { path: 'times', element: <AdminTeamsPage /> },
  { path: 'times/:id', element: <AdminTeamPage /> },
  { path: 'jogadores', element: <AdminPlayersPage /> },
  { path: 'campeonatos', element: <AdminTournamentsPage /> },
  { path: 'campeonatos/:id', element: <AdminTournamentPage /> },
  { path: 'campeonatos/:id/jogos/:matchId', element: <AdminFixturePage /> },
  { path: 'titulos', element: <AdminTitlesPage /> },
  { path: 'usuarios', element: <AdminUsersPage /> },
  { path: '*', element: <NotFoundPage /> },
];
