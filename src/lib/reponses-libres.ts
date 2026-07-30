import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

interface ReponseLibre {
  id: string;
  valeurTexte: string;
  jourSoumission: Date;
}

interface PageReponsesLibres {
  items: ReponseLibre[];
  total: number;
}

/**
 * Liste les réponses texte libre d'UNE question, jamais regroupées par
 * soumission : `soumissionId` n'est ni sélectionné ni exposé côté client, et
 * cette fonction ne doit jamais être appelée pour reconstituer l'ensemble des
 * réponses d'une même soumission — une vue par soumission permettrait de
 * recomposer le questionnaire complet d'un individu, et le style d'écriture
 * ou le contenu suffit à l'identifier. Chaque question a sa propre liste,
 * mélangée indépendamment des autres.
 *
 * Pagination à graine fixe par session (`seedSession`), pas `ORDER BY
 * random()` réévalué à chaque requête : ce dernier changerait d'ordre à
 * chaque page, faisant apparaître certaines réponses deux fois et en faisant
 * disparaître d'autres. Ici le tri (`md5(graine || id)`) est déterministe
 * pour une graine donnée — pages stables — mais imprévisible sans la
 * connaître. `seedSession` doit être généré une fois par session de
 * consultation côté appelant (page de résultats) et réutilisé pour toutes
 * ses pages ; une nouvelle session régénère une graine, donc un nouvel ordre.
 */
export async function listerReponsesLibres(params: {
  questionId: string;
  seedSession: string;
  page: number;
  parPage?: number;
}): Promise<PageReponsesLibres> {
  const { questionId, seedSession, page, parPage = 20 } = params;
  const offset = (page - 1) * parPage;

  const [lignes, total] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; valeur_texte: string; jour_soumission: Date }>>(Prisma.sql`
      SELECT r.id, r.valeur_texte, s.jour_soumission
      FROM reponse r
      JOIN soumission s ON s.id = r.soumission_id
      WHERE r.question_id = ${questionId}
        AND r.valeur_texte IS NOT NULL
      ORDER BY md5(${seedSession} || r.id::text)
      LIMIT ${parPage} OFFSET ${offset}
    `),
    prisma.reponse.count({ where: { questionId, valeurTexte: { not: null } } }),
  ]);

  return {
    items: lignes.map((l) => ({
      id: l.id,
      valeurTexte: l.valeur_texte,
      jourSoumission: l.jour_soumission,
    })),
    total,
  };
}
