import { prisma } from './prisma';

export type EtatInscriptionSeminaire =
  | { type: 'OUVERTE' }
  | { type: 'TERMINE' }
  | { type: 'FERMEES' }
  | { type: 'INDISPONIBLE' };

interface SeminairePourEtat {
  dateFin: Date;
  inscriptionOuverte: boolean;
  statut: string;
}

/**
 * Priorité des états, du plus spécifique au plus générique. Le bouton
 * « Je m'inscris » n'est visible que pour OUVERTE (statut=PUBLIE,
 * inscriptionOuverte=true, date de fin non dépassée) — aucune jauge de
 * places, aucun état COMPLET. INDISPONIBLE est un filet générique pour tout
 * autre statut (EN_COURS, CLOTURE, ARCHIVE avec inscriptionOuverte encore
 * vrai par erreur de configuration, etc.) — jamais un cas qu'on prétend ne
 * pas exister.
 */
export function calculerEtatInscription(seminaire: SeminairePourEtat): EtatInscriptionSeminaire {
  if (seminaire.dateFin < new Date()) return { type: 'TERMINE' };
  if (!seminaire.inscriptionOuverte) return { type: 'FERMEES' };
  if (seminaire.statut !== 'PUBLIE') return { type: 'INDISPONIBLE' };
  return { type: 'OUVERTE' };
}

export async function chargerSeminairePublic(codePublic: string) {
  const seminaire = await prisma.seminaire.findUnique({
    where: { codePublic },
    include: {
      cabinet: {
        select: {
          id: true,
          nom: true,
          logoUrl: true,
          couleurPrimaire: true,
          adresse: true,
          emailContact: true,
          telephoneContact: true,
        },
      },
      modules: { orderBy: { ordre: 'asc' } },
      formateurs: {
        include: { utilisateur: { select: { nom: true, prenom: true, cvUrl: true } } },
        orderBy: { roleFormateur: 'asc' },
      },
    },
  });

  if (!seminaire || seminaire.statut === 'BROUILLON' || seminaire.supprimeLe !== null) {
    return null;
  }

  return { seminaire, etat: calculerEtatInscription(seminaire) };
}
