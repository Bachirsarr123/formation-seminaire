-- Index partiels, non exprimables dans schema.prisma (comme
-- participant_contact_requis). Empêchent, au niveau base, deux participants
-- distincts avec le même email (ou le même téléphone) normalisé dans un
-- même cabinet — filet de sécurité contre la fenêtre de course où deux
-- inscriptions concurrentes de la même personne ne trouveraient, l'une et
-- l'autre, aucun participant existant au moment de leur lecture.
CREATE UNIQUE INDEX "participant_cabinet_email_unique"
  ON "participant" ("cabinet_id", "email")
  WHERE "email" IS NOT NULL;

CREATE UNIQUE INDEX "participant_cabinet_telephone_unique"
  ON "participant" ("cabinet_id", "telephone")
  WHERE "telephone" IS NOT NULL;
