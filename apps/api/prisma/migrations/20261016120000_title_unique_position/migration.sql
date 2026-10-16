-- Um campeonato gera no máximo um título por posição.
CREATE UNIQUE INDEX "Title_tournamentId_position_key" ON "Title"("tournamentId", "position");
