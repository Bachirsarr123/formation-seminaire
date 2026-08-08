-- CreateEnum
CREATE TYPE "type_notation" AS ENUM ('PRESENCE', 'PARTICIPATION', 'TEST', 'APPRECIATION');

-- CreateTable
CREATE TABLE "notation" (
    "id" TEXT NOT NULL,
    "inscription_id" TEXT NOT NULL,
    "formateur_id" TEXT NOT NULL,
    "type_notation" "type_notation" NOT NULL,
    "valeur" DOUBLE PRECISION,
    "bareme" DOUBLE PRECISION,
    "justification" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notation_inscription_id_key" ON "notation"("inscription_id");

-- CreateIndex
CREATE INDEX "notation_formateur_id_idx" ON "notation"("formateur_id");

-- AddForeignKey
ALTER TABLE "notation" ADD CONSTRAINT "notation_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notation" ADD CONSTRAINT "notation_formateur_id_fkey" FOREIGN KEY ("formateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contraintes CHECK manuelles (non exprimables dans le DSL Prisma), voir
-- schema.prisma :
--   - notation_justification_non_vide : NOT NULL n'empêche pas une chaîne
--     vide/blanche — "sans justification : refusé" est un critère
--     d'acceptation, pas une simple préférence.
--   - notation_valeur_coherente : APPRECIATION ne porte ni valeur ni barème ;
--     tout autre type porte les deux, avec la valeur bornée par le barème.
ALTER TABLE "notation" ADD CONSTRAINT "notation_justification_non_vide" CHECK (btrim("justification") <> '');

ALTER TABLE "notation" ADD CONSTRAINT "notation_valeur_coherente" CHECK (
  ("type_notation" = 'APPRECIATION' AND "valeur" IS NULL AND "bareme" IS NULL)
  OR
  ("type_notation" != 'APPRECIATION' AND "valeur" IS NOT NULL AND "bareme" IS NOT NULL AND "bareme" > 0 AND "valeur" >= 0 AND "valeur" <= "bareme")
);
