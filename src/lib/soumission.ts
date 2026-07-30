import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export class SoumissionDejaEffectueeError extends Error {
  constructor() {
    super('Une réponse a déjà été enregistrée pour ce jeton.');
    this.name = 'SoumissionDejaEffectueeError';
  }
}

interface ReponseInput {
  questionId: string;
  valeurNumerique?: number;
  valeurTexte?: string;
  valeurOptions?: Prisma.InputJsonValue;
}

interface SoumettreReponsesParams {
  jeton: string;
  questionnaireId: string;
  reponses: ReponseInput[];
}

// Précondition : le jeton a déjà été résolu et validé (existe, non expiré,
// non annulé) par le middleware /p/{jeton} avant l'appel à cette fonction.
// Si l'UPDATE ci-dessous touche 0 ligne, c'est donc soit une double
// soumission, soit un jeton invalide arrivé ici par un autre chemin que le
// middleware — dans les deux cas, la réponse ne doit pas être enregistrée.

/**
 * Une soumission = une transaction, deux écritures indépendantes qui ne se
 * référencent jamais l'une l'autre :
 *   1. UPDATE inscription (par jeton) — marque que quelqu'un a répondu.
 *   2. INSERT soumission + reponse — enregistre ce qui a été répondu.
 * Elles réussissent ou échouent ensemble (transaction), mais rien en base
 * ne permet de relier la ligne 1 à la ligne 2 (Règle 2).
 *
 * La garde anti-double-soumission est portée par le WHERE de l'UPDATE
 * (`a_repondu = false`), pas par une lecture préalable : impossible que deux
 * requêtes concurrentes passent toutes les deux le contrôle.
 *
 * `a_repondu_le` est fixé par Postgres via CURRENT_DATE (raw SQL), jamais par
 * l'horloge applicative : ni précision, ni fuseau côté client à surveiller.
 */
export async function soumettreReponses({
  jeton,
  questionnaireId,
  reponses,
}: SoumettreReponsesParams): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lignesTouchees = await tx.$executeRaw`
      UPDATE inscription
      SET a_repondu = true, a_repondu_le = CURRENT_DATE
      WHERE jeton = ${jeton} AND a_repondu = false
    `;

    if (lignesTouchees === 0) {
      throw new SoumissionDejaEffectueeError();
    }

    await tx.soumission.create({
      data: {
        questionnaireId,
        reponses: {
          create: reponses.map((r) => ({
            questionId: r.questionId,
            valeurNumerique: r.valeurNumerique,
            valeurTexte: r.valeurTexte,
            valeurOptions: r.valeurOptions,
          })),
        },
      },
    });
  });
}
