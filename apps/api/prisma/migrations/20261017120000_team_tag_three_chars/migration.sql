-- A tag (sigla) do time passa a ter no máximo 3 caracteres: as maiores ficam com os 3 primeiros.
UPDATE "Team" SET "shortName" = LEFT("shortName", 3) WHERE LENGTH("shortName") > 3;
