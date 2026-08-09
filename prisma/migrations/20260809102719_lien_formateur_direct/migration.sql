-- Lien direct formateur (/f/{codeFormateur}) : remplace la connexion par
-- lien magique, qui reposait sur JetonActionUtilisateur.type =
-- CONNEXION_FORMATEUR.

-- AlterTable : ajoute la colonne nullable d'abord (les lignes existantes
-- n'ont pas encore de code), la remplit, puis la contraint.
ALTER TABLE "seminaire_formateur" ADD COLUMN "code_formateur" TEXT;

-- Backfill des lignes déjà en base (données de démo) : une valeur unique
-- suffit, la génération applicative (nanoid) ne s'applique qu'aux lignes
-- créées à partir de maintenant.
UPDATE "seminaire_formateur"
SET "code_formateur" = md5(random()::text || clock_timestamp()::text || "seminaire_id" || "utilisateur_id")
WHERE "code_formateur" IS NULL;

ALTER TABLE "seminaire_formateur" ALTER COLUMN "code_formateur" SET NOT NULL;
CREATE UNIQUE INDEX "seminaire_formateur_code_formateur_key" ON "seminaire_formateur"("code_formateur");

-- Retire la valeur d'enum CONNEXION_FORMATEUR (Postgres ne permet pas de
-- retirer une valeur d'un type ENUM directement : on recrée le type).
-- Les jetons de ce type sont ceux de la connexion par lien magique
-- formateur, supprimée en même temps — jamais consommables après coup.
DELETE FROM "jeton_action_utilisateur" WHERE "type" = 'CONNEXION_FORMATEUR';

ALTER TYPE "type_jeton_action" RENAME TO "type_jeton_action_old";
CREATE TYPE "type_jeton_action" AS ENUM ('REINITIALISATION_MOT_DE_PASSE');
ALTER TABLE "jeton_action_utilisateur" ALTER COLUMN "type" TYPE "type_jeton_action" USING ("type"::text::"type_jeton_action");
DROP TYPE "type_jeton_action_old";
