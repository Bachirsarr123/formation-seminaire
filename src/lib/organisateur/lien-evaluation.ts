import 'server-only';
import { prisma } from '../prisma';
import { genererCodeAccesEvaluation } from '../jeton';

/**
 * Lien public de l'évaluation à chaud (/e/{codeAcces}) — même principe que
 * le recueil de besoins (Recueil.codeAcces, lib/organisateur/recueil.ts) :
 * un seul lien, généré une fois, à copier et diffuser à tous les
 * participants d'un coup, sans suivi par personne.
 *
 * Généré à la demande plutôt qu'à la création du séminaire : les séminaires
 * déjà en base au moment de l'ajout de cette colonne n'en avaient pas
 * encore, et il aurait fallu un script de rattrapage sinon. `null` si le
 * séminaire n'existe pas ou appartient à un autre cabinet (règle B).
 */
export async function obtenirOuCreerLienEvaluation(cabinetId: string, seminaireId: string): Promise<string | null> {
  const seminaire = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { codeAccesEvaluation: true },
  });
  if (!seminaire) return null;
  if (seminaire.codeAccesEvaluation) return seminaire.codeAccesEvaluation;

  const codeAccesEvaluation = genererCodeAccesEvaluation();
  await prisma.seminaire.update({ where: { id: seminaireId }, data: { codeAccesEvaluation } });
  return codeAccesEvaluation;
}
