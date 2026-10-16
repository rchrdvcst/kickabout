import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function setup() {
  execSync('npx prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: process.env,
    stdio: 'inherit',
  });
}
