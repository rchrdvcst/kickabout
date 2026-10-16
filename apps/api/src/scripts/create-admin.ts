import { hashPassword } from '../auth/password';
import { loadConfig } from '../config';
import { createPrisma } from '../db';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password || password.length < 8) {
  console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 8 caracteres) no apps/api/.env.');
  process.exit(1);
}

const prisma = createPrisma(loadConfig().databaseUrl);
const passwordHash = await hashPassword(password);
await prisma.user.upsert({ where: { email }, create: { email, passwordHash }, update: { passwordHash } });
console.log(`Admin ${email} pronto.`);
await prisma.$disconnect();
