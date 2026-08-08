-- CreateTable
CREATE TABLE "support_cours" (
    "id" TEXT NOT NULL,
    "seminaire_id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "nom_fichier" TEXT NOT NULL,
    "taille_fichier" INTEGER NOT NULL,
    "type_mime" TEXT NOT NULL,
    "url_stockage" TEXT NOT NULL,
    "visible_participants" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supprime_le" TIMESTAMP(3),

    CONSTRAINT "support_cours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_cours_seminaire_id_idx" ON "support_cours"("seminaire_id");

-- AddForeignKey
ALTER TABLE "support_cours" ADD CONSTRAINT "support_cours_seminaire_id_fkey" FOREIGN KEY ("seminaire_id") REFERENCES "seminaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
