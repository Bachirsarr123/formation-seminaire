import 'server-only';
import { TypeNotation } from '@prisma/client';
import { prisma } from '../prisma';
import { LIBELLE_TYPE_NOTATION } from '../libelles';
import type { ContexteOrganisateur } from './session';

// ============================================================
// Notation formateur (lot notation). À l'inverse de lib/questionnaire/
// resultats.ts (zone cloisonnée), ce fichier lit délibérément l'identité —
// c'est le but : le formateur note UNE personne. Jamais importé depuis
// l'espace participant (voir tests/schema/notation-confidentialite.test.ts).
// ============================================================

const LONGUEUR_JUSTIFICATION_MINIMALE = 10;

export interface NotationExistante {
  id: string;
  typeNotation: TypeNotation;
  valeur: number | null;
  bareme: number | null;
  justification: string;
  createdAt: Date;
  formateurNom: string;
  formateurPrenom: string;
}

export interface LigneNotation {
  inscriptionId: string;
  participant: { nom: string; prenom: string };
  notation: NotationExistante | null;
}

export interface VueNotations {
  seminaireTitre: string;
  // Un formateur ne peut noter que ses propres séminaires (vérifié dans
  // verifierAccesSeminaire) ET seulement tant que le séminaire n'est pas
  // archivé — l'organisateur, lui, ne note jamais (voir contraintes du lot :
  // "le formateur note", "l'organisateur voit").
  peutNoter: boolean;
  lignes: LigneNotation[];
}

/**
 * Un formateur ne voit/n'agit que sur ses propres séminaires (contrainte du
 * lot) — vérifié via SeminaireFormateur, jamais déduit d'autre chose. Une
 * ressource hors périmètre (autre cabinet, ou séminaire non affecté pour un
 * formateur) est traitée exactement comme une ressource inexistante
 * (règle B), jamais un 403.
 */
async function verifierAccesSeminaire(
  cabinetId: string,
  seminaireId: string,
  contexte: ContexteOrganisateur,
): Promise<{ id: string; titre: string; statut: string } | null> {
  const seminaire = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { id: true, titre: true, statut: true },
  });
  if (!seminaire) return null;

  if (contexte.role === 'FORMATEUR') {
    const affecte = await prisma.seminaireFormateur.findFirst({
      where: { seminaireId, utilisateurId: contexte.utilisateurId },
      select: { seminaireId: true },
    });
    if (!affecte) return null;
  }

  return seminaire;
}

export async function obtenirNotationsSeminaire(
  cabinetId: string,
  seminaireId: string,
  contexte: ContexteOrganisateur,
): Promise<VueNotations | null> {
  const seminaire = await verifierAccesSeminaire(cabinetId, seminaireId, contexte);
  if (!seminaire) return null;

  const inscriptions = await prisma.inscription.findMany({
    where: { seminaireId, statut: 'CONFIRMEE' },
    select: {
      id: true,
      participant: { select: { nom: true, prenom: true } },
      notation: {
        select: {
          id: true,
          typeNotation: true,
          valeur: true,
          bareme: true,
          justification: true,
          createdAt: true,
          formateur: { select: { nom: true, prenom: true } },
        },
      },
    },
  });

  const lignes: LigneNotation[] = inscriptions
    .map((i) => ({
      inscriptionId: i.id,
      participant: i.participant,
      notation: i.notation
        ? {
            id: i.notation.id,
            typeNotation: i.notation.typeNotation,
            valeur: i.notation.valeur,
            bareme: i.notation.bareme,
            justification: i.notation.justification,
            createdAt: i.notation.createdAt,
            formateurNom: i.notation.formateur.nom,
            formateurPrenom: i.notation.formateur.prenom,
          }
        : null,
    }))
    .sort(
      (a, b) =>
        a.participant.nom.localeCompare(b.participant.nom) || a.participant.prenom.localeCompare(b.participant.prenom),
    );

  return {
    seminaireTitre: seminaire.titre,
    peutNoter: contexte.role === 'FORMATEUR' && seminaire.statut !== 'ARCHIVE',
    lignes,
  };
}

export interface DonneesNotation {
  typeNotation: TypeNotation;
  valeur: number | null;
  bareme: number | null;
  justification: string;
}

export type ResultatEnregistrement = { ok: true } | { ok: false; erreur: string };

/**
 * Upsert sur inscriptionId (contrainte @unique) : noter à nouveau la même
 * inscription REMPLACE la notation existante, jamais un ajout — cohérent
 * avec "une seule note par inscription" (modèle de données du lot).
 * Revalide tout côté serveur (jamais confiance dans le client), y compris
 * la cohérence valeur/barème/type déjà protégée par une contrainte CHECK en
 * base (notation_valeur_coherente) : un message d'erreur clair vaut mieux
 * qu'une erreur Postgres brute remontée telle quelle.
 */
export async function enregistrerNotation(
  cabinetId: string,
  seminaireId: string,
  inscriptionId: string,
  contexte: ContexteOrganisateur,
  donnees: DonneesNotation,
): Promise<ResultatEnregistrement> {
  // Seul un formateur note (contrainte du lot : "le formateur note les
  // participants" / "l'organisateur voit") — vérifié explicitement, jamais
  // seulement par l'absence de bouton côté écran.
  if (contexte.role !== 'FORMATEUR') {
    return { ok: false, erreur: 'Seul un formateur peut noter un participant.' };
  }

  const seminaire = await verifierAccesSeminaire(cabinetId, seminaireId, contexte);
  if (!seminaire) return { ok: false, erreur: 'Séminaire introuvable.' };
  if (seminaire.statut === 'ARCHIVE') {
    return { ok: false, erreur: 'Ce séminaire est archivé : la notation ne peut plus être modifiée.' };
  }

  const inscription = await prisma.inscription.findFirst({
    where: { id: inscriptionId, seminaireId, statut: 'CONFIRMEE' },
    select: { id: true },
  });
  if (!inscription) return { ok: false, erreur: 'Participant introuvable.' };

  const justification = donnees.justification.trim();
  if (justification.length < LONGUEUR_JUSTIFICATION_MINIMALE) {
    return { ok: false, erreur: `La justification doit contenir au moins ${LONGUEUR_JUSTIFICATION_MINIMALE} caractères.` };
  }

  let valeur = donnees.valeur;
  let bareme = donnees.bareme;
  if (donnees.typeNotation === TypeNotation.APPRECIATION) {
    valeur = null;
    bareme = null;
  } else {
    if (valeur === null || bareme === null) {
      return { ok: false, erreur: 'Valeur et barème sont obligatoires pour ce type de notation.' };
    }
    if (bareme <= 0) return { ok: false, erreur: 'Le barème doit être supérieur à 0.' };
    if (valeur < 0 || valeur > bareme) {
      return { ok: false, erreur: `La valeur doit être comprise entre 0 et ${bareme}.` };
    }
  }

  await prisma.notation.upsert({
    where: { inscriptionId },
    create: { inscriptionId, formateurId: contexte.utilisateurId, typeNotation: donnees.typeNotation, valeur, bareme, justification },
    update: { formateurId: contexte.utilisateurId, typeNotation: donnees.typeNotation, valeur, bareme, justification },
  });

  return { ok: true };
}

function champCsv(valeur: string): string {
  if (/[;"\n\r]/.test(valeur)) return `"${valeur.replace(/"/g, '""')}"`;
  return valeur;
}

const BOM = String.fromCharCode(0xfeff);
const ENTETES_NOTATIONS = ['Nom', 'Prénom', 'Type de notation', 'Valeur', 'Barème', 'Justification'];

export async function genererCsvNotations(
  cabinetId: string,
  seminaireId: string,
  contexte: ContexteOrganisateur,
): Promise<string | null> {
  const vue = await obtenirNotationsSeminaire(cabinetId, seminaireId, contexte);
  if (!vue) return null;

  const lignes = [ENTETES_NOTATIONS.join(';')];
  for (const ligne of vue.lignes) {
    if (!ligne.notation) continue;
    lignes.push(
      [
        ligne.participant.nom,
        ligne.participant.prenom,
        LIBELLE_TYPE_NOTATION[ligne.notation.typeNotation],
        ligne.notation.valeur !== null ? String(ligne.notation.valeur) : '',
        ligne.notation.bareme !== null ? String(ligne.notation.bareme) : '',
        ligne.notation.justification,
      ]
        .map(champCsv)
        .join(';'),
    );
  }

  return BOM + lignes.join('\r\n') + '\r\n';
}
