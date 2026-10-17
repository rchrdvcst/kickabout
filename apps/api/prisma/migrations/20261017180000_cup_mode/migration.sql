-- Modo copa: novo formato e a prévia do sorteio dos grupos.
ALTER TYPE "TournamentFormat" ADD VALUE 'cup';
ALTER TABLE "Tournament" ADD COLUMN "groupDraw" JSONB;
