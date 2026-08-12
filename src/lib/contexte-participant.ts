import { cache } from 'react';
import { prisma } from './prisma';

export interface ContexteParticipant {
  inscription: {
    id: string;
    statut: string;
    aRepondu: boolean;
    aReponduLe: Date | null;
  };
  participant: {
    id: string;
    nom: string;
    prenom: string;
    email: string | null;
    telephone: string | null;
  };
  seminaire: {
    id: string;
    codePublic: string;
    titre: string;
    description: string | null;
    dateDebut: Date;
    dateFin: Date;
    lieu: string | null;
    tarif: string | null;
    modalite: string;
    statut: string;
    modules: { id: string; titre: string; dureeMinutes: number; ordre: number }[];
    cabinet: {
      id: string;
      nom: string;
      logoUrl: string | null;
      couleurPrimaire: string | null;
      adresse: string | null;
      emailContact: string | null;
      telephoneContact: string | null;
    };
    logoClientUrl: string | null;
  };
}

/**
 * Résout un jeton d'inscription (Règle 1 : /p/{jeton}) en contexte
 * participant. Retourne `null` pour un jeton inconnu, expiré, ou dont le
 * séminaire a été supprimé (logiquement) — dans tous ces cas, indistincts
 * pour l'appelant, qui doit répondre 404, jamais 401 ni 403 : on ne confirme
 * pas l'existence d'un jeton à quelqu'un qui le devine.
 *
 * Une inscription ANNULEE résout un contexte normalement (elle N'EST PAS
 * traitée comme invalide) : /p/{jeton} doit pouvoir poser le cookie et
 * rediriger vers /mon-espace, qui affichera l'état annulé et un bouton pour
 * se réinscrire. Le 404 reste réservé aux jetons inconnus ou expirés — pas
 * aux inscriptions annulées, qui restent une identité légitime.
 *
 * `jeton` ne doit JAMAIS être journalisé (log, erreur, message d'exception) :
 * c'est un secret d'accès au même titre qu'un mot de passe.
 *
 * Mémoïsé avec `cache()` : layout et page appellent tous les deux cette
 * fonction pour le même jeton dans un même rendu — un seul aller-retour DB.
 */
export const resoudreContexteParticipant = cache(
  async (jeton: string): Promise<ContexteParticipant | null> => {
    const inscription = await prisma.inscription.findUnique({
      where: { jeton },
      select: {
        id: true,
        statut: true,
        aRepondu: true,
        aReponduLe: true,
        jetonExpireLe: true,
        participant: {
          select: { id: true, nom: true, prenom: true, email: true, telephone: true },
        },
        seminaire: {
          select: {
            id: true,
            codePublic: true,
            titre: true,
            description: true,
            dateDebut: true,
            dateFin: true,
            lieu: true,
            tarif: true,
            modalite: true,
            statut: true,
            supprimeLe: true,
            modules: { select: { id: true, titre: true, dureeMinutes: true, ordre: true }, orderBy: { ordre: 'asc' } },
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
            logoClientUrl: true,
          },
        },
      },
    });

    if (!inscription) return null;
    if (inscription.jetonExpireLe && inscription.jetonExpireLe < new Date()) return null;
    if (inscription.seminaire.supprimeLe) return null;

    return {
      inscription: {
        id: inscription.id,
        statut: inscription.statut,
        aRepondu: inscription.aRepondu,
        aReponduLe: inscription.aReponduLe,
      },
      participant: inscription.participant,
      seminaire: {
        id: inscription.seminaire.id,
        codePublic: inscription.seminaire.codePublic,
        titre: inscription.seminaire.titre,
        description: inscription.seminaire.description,
        dateDebut: inscription.seminaire.dateDebut,
        dateFin: inscription.seminaire.dateFin,
        lieu: inscription.seminaire.lieu,
        tarif: inscription.seminaire.tarif,
        modalite: inscription.seminaire.modalite,
        statut: inscription.seminaire.statut,
        modules: inscription.seminaire.modules,
        cabinet: inscription.seminaire.cabinet,
        logoClientUrl: inscription.seminaire.logoClientUrl,
      },
    };
  },
);
