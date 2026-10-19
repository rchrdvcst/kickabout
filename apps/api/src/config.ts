export type PhoneVisibility = 'public' | 'authenticated';

export interface AppConfig {
  port: number;
  databaseUrl: string;
  phoneVisibility: PhoneVisibility;
  sessionTtlDays: number;
  secureCookies: boolean;
  googleClientId: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não definida.');
  const phoneVisibility = env.PHONE_VISIBILITY ?? 'public';
  if (phoneVisibility !== 'public' && phoneVisibility !== 'authenticated') {
    throw new Error(`PHONE_VISIBILITY inválida: ${phoneVisibility}`);
  }
  return {
    port: Number(env.PORT ?? 3333),
    databaseUrl,
    phoneVisibility,
    sessionTtlDays: Number(env.SESSION_TTL_DAYS ?? 30),
    secureCookies: env.NODE_ENV === 'production',
    googleClientId: env.GOOGLE_CLIENT_ID?.trim() || null,
  };
}
