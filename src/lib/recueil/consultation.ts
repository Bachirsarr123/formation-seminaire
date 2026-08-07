import 'server-only';
import { prisma } from '../prisma';

/**
 * Même logique d'accès que public.ts, mais par `codeConsultation` : ce
 * secret est le SEUL contrôle d'accès à des données nominatives, donc jamais
 * dérivable de `codeAcces` (voir lib/jeton.ts). Contrairement au formulaire
 * participant, la consultation reste accessible même si `actif` est passé à
 * faux : désactiver n'arrête que les nouveaux envois, jamais la lecture des
 * réponses déjà reçues.
 */
export async function chargerReponsesRecueil(codeConsultation: string) {
  const recueil = await prisma.recueil.findUnique({
    where: { codeConsultation },
    include: {
      seminaire: { select: { titre: true } },
      cabinet: { select: { nom: true, adresse: true, emailContact: true, telephoneContact: true } },
      questions: { orderBy: { ordre: 'asc' } },
      reponses: { orderBy: { createdAt: 'asc' } },
    },
  });

  return recueil;
}
