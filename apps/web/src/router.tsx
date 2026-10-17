import type { RouteObject } from 'react-router';
import { adminRoutes } from './admin-routes';
import { Layout } from './components/Layout';
import { ErrorPage } from './pages/ErrorPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentPage } from './pages/tournament/TournamentPage';
import { FixturePage } from './pages/FixturePage';
import { TeamsPage } from './pages/TeamsPage';
import { TeamPage } from './pages/TeamPage';
import { TeamBidPage } from './pages/TeamBidPage';
import { PlayerPage } from './pages/PlayerPage';
import { TitlesPage } from './pages/TitlesPage';
import { AdminLayout } from './pages/admin/AdminLayout';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        // Rota sem caminho: o erro de uma página aparece dentro do layout (cabeçalho continua visível).
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'campeonatos', element: <TournamentsPage /> },
          { path: 'campeonatos/:id', element: <TournamentPage /> },
          { path: 'campeonatos/:id/jogos/:matchId', element: <FixturePage /> },
          { path: 'times', element: <TeamsPage /> },
          { path: 'times/:id', element: <TeamPage /> },
          { path: 'times/:id/bid', element: <TeamBidPage /> },
          { path: 'jogadores/:id', element: <PlayerPage /> },
          { path: 'titulos', element: <TitlesPage /> },
          { path: 'entrar', element: <LoginPage /> },
          { path: 'admin', element: <AdminLayout />, children: adminRoutes },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
