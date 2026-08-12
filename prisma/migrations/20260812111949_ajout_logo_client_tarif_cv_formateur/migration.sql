-- AlterTable
ALTER TABLE "seminaire" ADD COLUMN     "logo_client_url" TEXT,
ADD COLUMN     "tarif" TEXT;

-- AlterTable
ALTER TABLE "utilisateur" ADD COLUMN     "cv_url" TEXT;
