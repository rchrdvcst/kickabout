import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from './config';

export interface AppDeps {
  prisma: PrismaClient;
  config: AppConfig;
}
