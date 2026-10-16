import { buildApp } from './app';
import { loadConfig } from './config';
import { createPrisma } from './db';

const config = loadConfig();
const app = buildApp({ prisma: createPrisma(config.databaseUrl), config, logger: true });
await app.listen({ port: config.port, host: '0.0.0.0' });
