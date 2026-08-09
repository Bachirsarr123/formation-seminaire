import 'server-only';
import { prisma } from '../prisma';

/**
 * Même logique d'accès que public.ts, mais par `codeConsultation` : ce
 * secret est le SEUL contrôle d'accès à ces données, donc jamais dérivable
 * de `codeAcces` (voir lib/jeton.ts). Contrairement au formulaire
 * participant, la consultation reste accessible même si `actif` est passé à
 * faux : désactiver n'arrête que les nouveaux envois, jamais la lecture des
 * réponses déjà reçues.
 *
 * Le formateur voit CE QUE les gens ont répondu, jamais QUI — nom, prénom,
 * fonction et organisation sont volontairement absents du `select` ci-dessous
 * (pas seulement masqués à l'affichage) : la seule vue nominative complète
 * est lib/organisateur/recueil.ts, réservée à l'espace organisateur.
 */
const INCLUSION_RECUEIL_ANONYME = {
  seminaire: { select: { titre: true } },
  cabinet: { select: { nom: true, adresse: true, emailContact: true, telephoneContact: true } },
  questions: { orderBy: { ordre: 'asc' as const } },
  reponses: { orderBy: { createdAt: 'asc' as const }, select: { id: true, reponses: true } },
};

export async function chargerReponsesRecueil(codeConsultation: string) {
  return prisma.recueil.findUnique({ where: { codeConsultation }, include: INCLUSION_RECUEIL_ANONYME });
}

// Même vue anonymisée que ci-dessus, mais résolue par séminaire plutôt que
// par codeConsultation — utilisée par /f/{codeFormateur} (lib/formateur-lien.ts),
// qui a déjà validé l'accès à CE séminaire par un autre secret (le code
// formateur) et n'a donc pas besoin d'un second code recueil pour la même
// personne. `seminaireId` est @unique sur Recueil (un séminaire n'a jamais
// plus d'un recueil).
export async function chargerReponsesRecueilParSeminaire(seminaireId: string) {
  return prisma.recueil.findUnique({ where: { seminaireId }, include: INCLUSION_RECUEIL_ANONYME });
}
