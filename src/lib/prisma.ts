import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// 20s uniquement en test : cet hôte de dev partagé peut ralentir une
// transaction par ailleurs correcte au point de dépasser le défaut Prisma
// (5000 ms). En production, ce délai généreux serait dangereux : la
// transaction de jauge pose un verrou sur la ligne du séminaire, et une
// transaction autorisée à traîner 20s bloquerait toutes les autres
// inscriptions au même séminaire — exactement au moment le plus critique
// (ouverture des inscriptions, pic d'affluence). Un échec rapide (5s, le
// défaut Prisma) vaut mieux qu'une file d'attente invisible qui grossit
// derrière un verrou.
const timeoutTransaction = process.env.NODE_ENV === 'test' ? 20000 : 5000;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    transactionOptions: { timeout: timeoutTransaction },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
