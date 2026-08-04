-- CreateTable
CREATE TABLE "import_en_attente" (
    "id" TEXT NOT NULL,
    "seminaire_id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "donnees" JSONB NOT NULL,
    "expire_le" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_en_attente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_en_attente_seminaire_id_idx" ON "import_en_attente"("seminaire_id");

-- AddForeignKey
ALTER TABLE "import_en_attente" ADD CONSTRAINT "import_en_attente_seminaire_id_fkey" FOREIGN KEY ("seminaire_id") REFERENCES "seminaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_en_attente" ADD CONSTRAINT "import_en_attente_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
