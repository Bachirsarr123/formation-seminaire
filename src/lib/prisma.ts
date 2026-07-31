import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// 20s en test ET en développement : cet hôte de dev partagé peut ralentir
// une transaction par ailleurs correcte au point de dépasser le défaut
// Prisma (5000 ms) — vécu concrètement (next dev, pas seulement Vitest).
// Seule la PRODUCTION garde le défaut strict : la transaction de jauge pose
// un verrou sur la ligne du séminaire, et une transaction autorisée à
// traîner 20s y bloquerait toutes les autres inscriptions au même séminaire
// — exactement au moment le plus critique (ouverture des inscriptions, pic
// d'affluence). Un échec rapide (5s) vaut mieux qu'une file d'attente
// invisible qui grossit derrière un verrou — mais seulement là où ce risque
// existe réellement, c'est-à-dire en production avec de vrais utilisateurs
// concurrents.
const timeoutTransaction = process.env.NODE_ENV === 'production' ? 5000 : 20000;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    transactionOptions: { timeout: timeoutTransaction },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
