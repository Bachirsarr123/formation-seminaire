-- CreateEnum
CREATE TYPE "finalite_consentement" AS ENUM ('INSCRIPTION_EVALUATION', 'COMMUNICATIONS', 'PARTAGE_EMPLOYEUR');

-- CreateTable
CREATE TABLE "consentement" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "inscription_id" TEXT,
    "finalite" "finalite_consentement" NOT NULL,
    "version_texte" TEXT NOT NULL,
    "donne_le" TIMESTAMP(3) NOT NULL,
    "retire_le" TIMESTAMP(3),
    "preuve_hash" TEXT NOT NULL,

    CONSTRAINT "consentement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consentement_participant_id_finalite_idx" ON "consentement"("participant_id", "finalite");

-- CreateIndex
CREATE INDEX "consentement_inscription_id_idx" ON "consentement"("inscription_id");

-- AddForeignKey
ALTER TABLE "consentement" ADD CONSTRAINT "consentement_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentement" ADD CONSTRAINT "consentement_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint
-- PARTAGE_EMPLOYEUR est scopé par inscription (voir index partiel plus bas) :
-- inscription_id ne doit donc jamais être nul pour cette finalité, sinon
-- l'index partiel perdrait son sens (deux NULL ne se heurtent jamais).
ALTER TABLE "consentement" ADD CONSTRAINT "consentement_partage_employeur_inscription_requise"
  CHECK (finalite <> 'PARTAGE_EMPLOYEUR' OR inscription_id IS NOT NULL);

-- CreateIndex (partiel, non exprimable dans schema.prisma)
-- INSCRIPTION_EVALUATION et COMMUNICATIONS : une seule ligne active par
-- participant, tous séminaires confondus.
CREATE UNIQUE INDEX "consentement_actif_unique_global"
  ON "consentement" ("participant_id", "finalite")
  WHERE "retire_le" IS NULL AND "finalite" IN ('INSCRIPTION_EVALUATION', 'COMMUNICATIONS');

-- CreateIndex (partiel, non exprimable dans schema.prisma)
-- PARTAGE_EMPLOYEUR : une décision par (participant, inscription) — consentir
-- au partage avec l'employeur A ne vaut pas consentement pour l'employeur B.
CREATE UNIQUE INDEX "consentement_actif_unique_par_inscription"
  ON "consentement" ("participant_id", "inscription_id", "finalite")
  WHERE "retire_le" IS NULL AND "finalite" = 'PARTAGE_EMPLOYEUR';

-- Trigger : table en ajout seul.
-- UPDATE : seule retire_le est modifiable, une seule fois, et jamais pour
-- INSCRIPTION_EVALUATION (ce n'est pas un consentement retirable mais la
-- preuve qu'une information a été donnée, et de quelle version).
CREATE FUNCTION empecher_modification_consentement() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.inscription_id IS DISTINCT FROM OLD.inscription_id
     OR NEW.finalite IS DISTINCT FROM OLD.finalite
     OR NEW.version_texte IS DISTINCT FROM OLD.version_texte
     OR NEW.donne_le IS DISTINCT FROM OLD.donne_le
     OR NEW.preuve_hash IS DISTINCT FROM OLD.preuve_hash
     OR (OLD.retire_le IS NOT NULL AND NEW.retire_le IS DISTINCT FROM OLD.retire_le)
  THEN
    RAISE EXCEPTION 'consentement: seule retire_le est modifiable, une seule fois';
  END IF;

  IF OLD.finalite = 'INSCRIPTION_EVALUATION' AND NEW.retire_le IS NOT NULL THEN
    RAISE EXCEPTION 'consentement: INSCRIPTION_EVALUATION n''est pas retirable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consentement_append_only
  BEFORE UPDATE ON "consentement"
  FOR EACH ROW EXECUTE FUNCTION empecher_modification_consentement();

-- Trigger : DELETE toujours refusé. Une table "en ajout seul" dans laquelle
-- on peut supprimer une ligne n'est pas en ajout seul.
CREATE FUNCTION empecher_suppression_consentement() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'consentement: suppression interdite (table en ajout seul)';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consentement_pas_de_suppression
  BEFORE DELETE ON "consentement"
  FOR EACH ROW EXECUTE FUNCTION empecher_suppression_consentement();
