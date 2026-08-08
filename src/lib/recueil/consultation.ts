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
export async function chargerReponsesRecueil(codeConsultation: string) {
  const recueil = await prisma.recueil.findUnique({
    where: { codeConsultation },
    include: {
      seminaire: { select: { titre: true } },
      cabinet: { select: { nom: true, adresse: true, emailContact: true, telephoneContact: true } },
      questions: { orderBy: { ordre: 'asc' } },
      reponses: { orderBy: { createdAt: 'asc' }, select: { id: true, reponses: true } },
    },
  });

  return recueil;
}
