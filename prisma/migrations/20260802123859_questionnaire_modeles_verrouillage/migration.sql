-- AlterTable
ALTER TABLE "question" ADD COLUMN     "autorise_sans_opinion" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- cabinet_id ajoutée nullable d'abord : la table a des lignes existantes,
-- impossible d'ajouter une colonne NOT NULL sans valeur par défaut. Backfill
-- ci-dessous depuis seminaire.cabinet_id (100% des lignes existantes ont un
-- séminaire à ce stade), puis contrainte NOT NULL posée après coup.
ALTER TABLE "questionnaire" ADD COLUMN     "cabinet_id" TEXT,
ADD COLUMN     "est_modele" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modele_origine_id" TEXT,
ADD COLUMN     "nom" TEXT,
ADD COLUMN     "verrouille_le" TIMESTAMP(3),
ALTER COLUMN "seminaire_id" DROP NOT NULL;

-- Backfill : cabinet_id d'un questionnaire de séminaire = cabinet_id de ce séminaire.
UPDATE "questionnaire" q
SET "cabinet_id" = s."cabinet_id"
FROM "seminaire" s
WHERE q."seminaire_id" = s."id";

ALTER TABLE "questionnaire" ALTER COLUMN "cabinet_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "questionnaire_cabinet_id_idx" ON "questionnaire"("cabinet_id");

-- AddForeignKey
ALTER TABLE "questionnaire" ADD CONSTRAINT "questionnaire_cabinet_id_fkey" FOREIGN KEY ("cabinet_id") REFERENCES "cabinet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire" ADD CONSTRAINT "questionnaire_modele_origine_id_fkey" FOREIGN KEY ("modele_origine_id") REFERENCES "questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint
-- Un modèle est un questionnaire détaché d'un séminaire, jamais les deux à
-- la fois, jamais ni l'un ni l'autre.
ALTER TABLE "questionnaire" ADD CONSTRAINT "questionnaire_modele_xor_seminaire"
  CHECK ((est_modele = true AND seminaire_id IS NULL)
      OR (est_modele = false AND seminaire_id IS NOT NULL));

-- Trigger : verrouille_le posé automatiquement au passage en PUBLIE, jamais
-- modifiable une fois posé (même en repassant par BROUILLON/FERME). Un
-- questionnaire publié SANS réponse reste néanmoins modifiable (voir les
-- triggers section/question plus bas) : verrouille_le seul n'est qu'une date
-- de publication, pas encore un verrou — c'est verrouille_le + au moins une
-- soumission qui fige la structure.
CREATE FUNCTION verrouiller_questionnaire_publie() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'PUBLIE' AND NEW.verrouille_le IS NULL THEN
    NEW.verrouille_le := now();
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.verrouille_le IS NOT NULL AND NEW.verrouille_le IS DISTINCT FROM OLD.verrouille_le THEN
    RAISE EXCEPTION 'questionnaire: verrouille_le est définitif une fois posé';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questionnaire_verrouillage_auto
  BEFORE INSERT OR UPDATE ON "questionnaire"
  FOR EACH ROW EXECUTE FUNCTION verrouiller_questionnaire_publie();

-- Trigger : structure immuable dès qu'au moins une réponse existe.
-- Motif (non applicatif, en base) : si le libellé d'une question change
-- après que dix personnes y ont répondu, la moyenne affichée agrège des
-- réponses à deux questions différentes, silencieusement. Un questionnaire
-- publié mais encore sans aucune soumission reste donc modifiable — l'erreur
-- de frappe repérée avant toute réponse doit pouvoir être corrigée.
CREATE FUNCTION empecher_modification_section_verrouillee() RETURNS TRIGGER AS $$
DECLARE
  v_id_questionnaire TEXT := COALESCE(NEW.questionnaire_id, OLD.questionnaire_id);
  v_verrouille BOOLEAN;
BEGIN
  SELECT (q.verrouille_le IS NOT NULL AND EXISTS (
            SELECT 1 FROM "soumission" so WHERE so.questionnaire_id = q.id
          ))
  INTO v_verrouille
  FROM "questionnaire" q
  WHERE q.id = v_id_questionnaire;

  IF v_verrouille THEN
    RAISE EXCEPTION 'section: questionnaire verrouillé (réponses déjà reçues), structure immuable';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER section_verrouillage
  BEFORE INSERT OR UPDATE OR DELETE ON "section"
  FOR EACH ROW EXECUTE FUNCTION empecher_modification_section_verrouillee();

-- Même règle pour question, en remontant par section (question n'a pas de
-- questionnaire_id direct). Vérifie l'ancienne ET la nouvelle section sur un
-- UPDATE de section_id : déplacer une question depuis ou vers un
-- questionnaire verrouillé est tout autant interdit.
CREATE FUNCTION empecher_modification_question_verrouillee() RETURNS TRIGGER AS $$
DECLARE
  v_ancien BOOLEAN := FALSE;
  v_nouveau BOOLEAN := FALSE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT (q.verrouille_le IS NOT NULL AND EXISTS (
              SELECT 1 FROM "soumission" so WHERE so.questionnaire_id = q.id
            ))
    INTO v_ancien
    FROM "section" sec JOIN "questionnaire" q ON q.id = sec.questionnaire_id
    WHERE sec.id = OLD.section_id;
  END IF;

  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    SELECT (q.verrouille_le IS NOT NULL AND EXISTS (
              SELECT 1 FROM "soumission" so WHERE so.questionnaire_id = q.id
            ))
    INTO v_nouveau
    FROM "section" sec JOIN "questionnaire" q ON q.id = sec.questionnaire_id
    WHERE sec.id = NEW.section_id;
  END IF;

  IF v_ancien OR v_nouveau THEN
    RAISE EXCEPTION 'question: questionnaire verrouillé (réponses déjà reçues), structure immuable';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER question_verrouillage
  BEFORE INSERT OR UPDATE OR DELETE ON "question"
  FOR EACH ROW EXECUTE FUNCTION empecher_modification_question_verrouillee();
