import 'server-only';
import { cache } from 'react';
import type { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from './prisma';

export interface ContexteLienFormateur {
  utilisateurId: string;
  cabinetId: string;
  formateur: { nom: string; prenom: string };
  seminaire: {
    id: string;
    titre: string;
    dateDebut: Date;
    dateFin: Date;
    lieu: string | null;
    modalite: Modalite;
    statut: StatutSeminaire;
  };
}

/**
 * Résout /f/{codeFormateur} : même principe que resoudreContexteParticipant
 * (lib/contexte-participant.ts) et chargerReponsesRecueil (par
 * codeConsultation) — le code EST le seul contrôle d'accès, aucune session,
 * aucun cookie. `null` pour un code inconnu, un compte formateur désactivé,
 * ou un séminaire supprimé logiquement — jamais distingué, jamais un 403.
 *
 * Mémoïsé par requête (cache()) : la page principale et notations/page.tsx
 * résolvent chacune ce code, potentiellement dans le même rendu.
 */
export const resoudreContexteLienFormateur = cache(
  async (codeFormateur: string): Promise<ContexteLienFormateur | null> => {
    const affectation = await prisma.seminaireFormateur.findUnique({
      where: { codeFormateur },
      select: {
        utilisateurId: true,
        utilisateur: { select: { nom: true, prenom: true, actif: true } },
        seminaire: {
          select: {
            id: true,
            cabinetId: true,
            titre: true,
            dateDebut: true,
            dateFin: true,
            lieu: true,
            modalite: true,
            statut: true,
            supprimeLe: true,
          },
        },
      },
    });

    if (!affectation) return null;
    if (!affectation.utilisateur.actif) return null;
    if (affectation.seminaire.supprimeLe) return null;

    return {
      utilisateurId: affectation.utilisateurId,
      cabinetId: affectation.seminaire.cabinetId,
      formateur: { nom: affectation.utilisateur.nom, prenom: affectation.utilisateur.prenom },
      seminaire: {
        id: affectation.seminaire.id,
        titre: affectation.seminaire.titre,
        dateDebut: affectation.seminaire.dateDebut,
        dateFin: affectation.seminaire.dateFin,
        lieu: affectation.seminaire.lieu,
        modalite: affectation.seminaire.modalite,
        statut: affectation.seminaire.statut,
      },
    };
  },
);
