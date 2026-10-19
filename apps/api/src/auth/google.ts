import type { PrismaClient, User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../errors';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/** Confere o ID token do botão do Google e devolve o perfil; rejeita token inválido. */
export type VerifyGoogleToken = (credential: string, clientId: string) => Promise<GoogleProfile>;

/** Verificação real: assinatura, emissor, destinatário (clientId) e validade, pela biblioteca do Google. */
export function googleTokenVerifier(): VerifyGoogleToken {
  const client = new OAuth2Client();
  return async (credential, clientId) => {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new Error('Token do Google sem conta ou email.');
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  };
}

/**
 * Acha o usuário pela conta Google; senão, pelo email (é assim que o organizador atual passa a entrar com Google);
 * senão, cria um usuário comum. Atualiza nome, foto e último acesso.
 */
export async function signInWithGoogle(prisma: PrismaClient, profile: GoogleProfile): Promise<User> {
  const email = profile.email.trim().toLowerCase();
  const data = { name: profile.name, avatarUrl: profile.picture, lastLoginAt: new Date() };
  return prisma.$transaction(async (tx) => {
    const byGoogle = await tx.user.findUnique({ where: { googleId: profile.sub } });
    if (byGoogle) return tx.user.update({ where: { id: byGoogle.id }, data });
    const byEmail = await tx.user.findUnique({ where: { email } });
    if (byEmail?.googleId) {
      throw new AppError(409, 'GOOGLE_ACCOUNT_CONFLICT', 'Este email já está ligado a outra conta Google.');
    }
    if (byEmail) return tx.user.update({ where: { id: byEmail.id }, data: { ...data, googleId: profile.sub } });
    return tx.user.create({ data: { ...data, email, googleId: profile.sub, role: 'user' } });
  });
}
