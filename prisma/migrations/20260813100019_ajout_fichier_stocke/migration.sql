-- CreateTable
CREATE TABLE "fichier_stocke" (
    "id" TEXT NOT NULL,
    "contenu" BYTEA NOT NULL,
    "type_mime" TEXT NOT NULL,
    "taille_fichier" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fichier_stocke_pkey" PRIMARY KEY ("id")
);
