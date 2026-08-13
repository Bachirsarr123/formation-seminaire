-- AlterTable
ALTER TABLE "seminaire" ADD COLUMN     "code_acces_evaluation" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "seminaire_code_acces_evaluation_key" ON "seminaire"("code_acces_evaluation");
