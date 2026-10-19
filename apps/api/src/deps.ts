import type { PrismaClient } from '@prisma/client';
import type { VerifyGoogleToken } from './auth/google';
import type { AppConfig } from './config';

export interface AppDeps {
  prisma: PrismaClient;
  config: AppConfig;
  /** Verificação do token do Google; os testes passam uma falsa. Padrão: a real. */
  verifyGoogleToken?: VerifyGoogleToken;
}
