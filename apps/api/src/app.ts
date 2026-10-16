import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAuth } from './auth/hooks';
import { registerAuthRoutes } from './auth/routes';
import type { AppDeps } from './deps';
import { registerErrorHandler } from './errors';
import { registerFixtureRoutes } from './fixtures/routes';
import { registerPlayerRoutes } from './players/routes';
import { registerTeamRoutes } from './teams/routes';
import { registerTitleRoutes } from './titles/routes';
import { registerTournamentRoutes } from './tournaments/routes';

export function buildApp(deps: AppDeps & { logger?: boolean }): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false });
  app.register(cookie);
  registerErrorHandler(app);

  app.register(
    async (api) => {
      registerAuth(api, deps);
      registerAuthRoutes(api, deps);
      registerTeamRoutes(api, deps);
      registerPlayerRoutes(api, deps);
      registerTournamentRoutes(api, deps);
      registerFixtureRoutes(api, deps);
      registerTitleRoutes(api, deps);
      api.get('/health', async () => ({ ok: true }));
    },
    { prefix: '/api' },
  );

  return app;
}
