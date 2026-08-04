import 'server-only';
import { Prisma, SourceInscription, StatutInscription } from '@prisma/client';
import { prisma } from '../prisma';
import { trouverOuCreerParticipant } from '../participant';
import { inscrireParticipant } from '../inscription';
import { validerChampsParticipant } from './formulaire-participant';
import type { DonneesParticipantManuel } from './participants';

// ============================================================
// Import CSV en masse (lot 4, étape 7) — variante en masse de l'ajout
// manuel (participants.ts) : mêmes décisions (statut toujours CONFIRMEE,
// aucun Consentement enregistré — c'est l'organisateur qui affirme
// l'inscription, pas le participant lui-même).
// ============================================================

export const PLAFOND_TAILLE_OCTETS = 1_048_576; // 1 Mo
export const PLAFOND_LIGNES = 500; // lignes de données, hors en-tête
const DUREE_APERCU_MS = 30 * 60 * 1000; // 30 minutes

// ------------------------------------------------------------
// Décodage : UTF-8 strict, repli Windows-1252 (décision 5)
// ------------------------------------------------------------

// Windows-1252 ne diffère de Latin-1 (ISO-8859-1) que sur les octets
// 0x80-0x9F, qui sont des caractères de contrôle C1 inutilisés en Latin-1
// mais des caractères imprimables courants en français (œ, guillemets
// courbes, tiret cadratin...) dans un export Excel. Le reste (0x00-0x7F et
// 0xA0-0xFF) est une correspondance directe octet -> point de code.
const WINDOWS_1252_HAUT: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

function decoderWindows1252(buffer: Buffer): string {
  let resultat = '';
  for (const octet of buffer) {
    if (octet >= 0x80 && octet <= 0x9f) {
      resultat += String.fromCharCode(WINDOWS_1252_HAUT[octet] ?? 0xfffd);
    } else {
      resultat += String.fromCharCode(octet);
    }
  }
  return resultat;
}

/**
 * Un CSV exporté depuis Excel en français arrive souvent en Windows-1252,
 * pas en UTF-8 — sans détection, tous les accents seraient cassés.
 * `TextDecoder(..., { fatal: true })` lève une exception sur toute séquence
 * d'octets qui n'est pas de l'UTF-8 valide : un fichier Windows-1252
 * contenant des lettres accentuées la déclenche presque systématiquement
 * (un octet seul de la plage 0x80-0xFF n'est jamais un UTF-8 valide isolé).
 * BOM UTF-8 géré nativement par TextDecoder (ignoreBOM: false par défaut).
 */
export function decoderContenuCsv(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return decoderWindows1252(buffer);
  }
}

// ------------------------------------------------------------
// Parsing CSV : délimiteur détecté, machine à états pour les guillemets
// ------------------------------------------------------------

export function detecterDelimiteur(contenu: string): ',' | ';' {
  const premiereLigne = contenu.split(/\r\n|\r|\n/, 1)[0] ?? '';
  const nbPointVirgule = (premiereLigne.match(/;/g) ?? []).length;
  const nbVirgule = (premiereLigne.match(/,/g) ?? []).length;
  return nbPointVirgule > nbVirgule ? ';' : ',';
}

/**
 * Parseur CSV à la main (pas de nouvelle dépendance, même philosophie que
 * l'échappement CSV fait main de l'étape 6, export-participants.ts) : un
 * simple `split(delimiteur)` casserait sur un champ entre guillemets
 * contenant le délimiteur (ex. "Dupont, SARL") ou un saut de ligne.
 */
export function analyserLignesCsv(contenu: string, delimiteur: string): string[][] {
  const lignes: string[][] = [];
  let ligneCourante: string[] = [];
  let champCourant = '';
  let dansGuillemets = false;

  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i];

    if (dansGuillemets) {
      if (c === '"') {
        if (contenu[i + 1] === '"') {
          champCourant += '"';
          i++;
        } else {
          dansGuillemets = false;
        }
      } else {
        champCourant += c;
      }
      continue;
    }

    if (c === '"') {
      dansGuillemets = true;
    } else if (c === delimiteur) {
      ligneCourante.push(champCourant);
      champCourant = '';
    } else if (c === '\r') {
      // ignoré, la fin de ligne est gérée par \n
    } else if (c === '\n') {
      ligneCourante.push(champCourant);
      lignes.push(ligneCourante);
      ligneCourante = [];
      champCourant = '';
    } else {
      champCourant += c;
    }
  }

  if (champCourant !== '' || ligneCourante.length > 0) {
    ligneCourante.push(champCourant);
    lignes.push(ligneCourante);
  }

  // Lignes entièrement vides (souvent en fin de fichier) : ignorées, elles
  // ne comptent pas comme des lignes de données.
  return lignes.filter((ligne) => !(ligne.length === 1 && ligne[0] === ''));
}

// ------------------------------------------------------------
// Mapping des en-têtes
// ------------------------------------------------------------

type ChampParticipant = 'nom' | 'prenom' | 'email' | 'telephone' | 'fonction' | 'organisation';

const ALIAS_ENTETES: Record<string, ChampParticipant> = {
  nom: 'nom',
  prenom: 'prenom',
  email: 'email',
  courriel: 'email',
  telephone: 'telephone',
  tel: 'telephone',
  fonction: 'fonction',
  organisation: 'organisation',
  entreprise: 'organisation',
};

// Plage Unicode des diacritiques combinants U+0300 (grave) à U+036F,
// laissés par normalize('NFD') après décomposition d'une lettre accentuée
// (ex. "é" -> "e" + U+0301). Les deux caractères dans la classe ci-dessous
// sont ces bornes elles-mêmes (U+0300 et U+036F), pas du texte normal —
// invisibles/illisibles dans la plupart des rendus de diff, d'où cette note.
const PLAGE_DIACRITIQUES = /[̀-ͯ]/g;

function normaliserEntete(valeur: string): string {
  return valeur.trim().toLowerCase().normalize('NFD').replace(PLAGE_DIACRITIQUES, '');
}

/**
 * En-têtes reconnus par nom (insensibles à la casse et aux accents), pas
 * par position de colonne — un organisateur peut réordonner ses colonnes
 * sans casser l'import. `nom` et `prenom` obligatoires : sans eux,
 * impossible de savoir quoi valider dans le reste du fichier, donc rejet
 * global immédiat (seule erreur qui n'est pas "partielle").
 */
export function mapperEntetes(entetes: string[]): { colonnes: Partial<Record<ChampParticipant, number>> } | { erreur: string } {
  const colonnes: Partial<Record<ChampParticipant, number>> = {};
  entetes.forEach((entete, index) => {
    const champ = ALIAS_ENTETES[normaliserEntete(entete)];
    if (champ && colonnes[champ] === undefined) colonnes[champ] = index;
  });

  if (colonnes.nom === undefined || colonnes.prenom === undefined) {
    return {
      erreur:
        "Colonnes obligatoires manquantes : « Nom » et « Prénom ». Vérifiez la première ligne (en-têtes) du fichier.",
    };
  }

  return { colonnes };
}

// ------------------------------------------------------------
// Prévisualisation
// ------------------------------------------------------------

export interface LigneImportValide extends DonneesParticipantManuel {
  numeroLigne: number;
}

export interface LigneImportErreur {
  numeroLigne: number;
  motif: string;
}

export interface LigneImportDoublonFichier {
  numeroLigne: number;
  premiereOccurrenceLigne: number;
}

export interface LigneImportDejaInscrite {
  numeroLigne: number;
  nom: string;
  prenom: string;
}

export interface RapportPreviewImport {
  totalLignes: number;
  lignesValides: LigneImportValide[];
  dejaInscrites: LigneImportDejaInscrite[];
  doublonsFichier: LigneImportDoublonFichier[];
  erreurs: LigneImportErreur[];
  // Absent si aucune ligne valide (rien à confirmer).
  apercuId?: string;
}

/**
 * Lecture seule sur les tables métier : ne modifie jamais Participant ni
 * Inscription. La seule écriture est la ligne ImportEnAttente qui porte les
 * lignes déjà validées, pour que confirmerImportCsv n'ait jamais besoin de
 * rejouer/reparser le fichier (jamais stocké sur disque, jamais conservé
 * au-delà de cet appel — décision 1 de l'énoncé).
 */
export async function previsualiserImportCsv(
  cabinetId: string,
  seminaireId: string,
  utilisateurId: string,
  buffer: Buffer,
): Promise<RapportPreviewImport | { erreurGlobale: string } | null> {
  const seminaireExiste = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { id: true },
  });
  if (!seminaireExiste) return null;

  if (buffer.byteLength === 0) {
    return { erreurGlobale: 'Le fichier est vide.' };
  }
  if (buffer.byteLength > PLAFOND_TAILLE_OCTETS) {
    return { erreurGlobale: `Le fichier dépasse la taille maximale autorisée (${Math.floor(PLAFOND_TAILLE_OCTETS / 1024)} Ko).` };
  }

  const contenu = decoderContenuCsv(buffer);
  const delimiteur = detecterDelimiteur(contenu);
  const lignesBrutes = analyserLignesCsv(contenu, delimiteur);
  if (lignesBrutes.length === 0) {
    return { erreurGlobale: 'Le fichier est vide.' };
  }

  const [entetesBrutes, ...lignesDonnees] = lignesBrutes as [string[], ...string[][]];
  if (lignesDonnees.length > PLAFOND_LIGNES) {
    return {
      erreurGlobale: `Le fichier contient ${lignesDonnees.length} lignes de données, au-delà du maximum autorisé (${PLAFOND_LIGNES}). Scindez-le en plusieurs fichiers.`,
    };
  }

  const mappage = mapperEntetes(entetesBrutes);
  if ('erreur' in mappage) return { erreurGlobale: mappage.erreur };
  const { colonnes } = mappage;

  const erreurs: LigneImportErreur[] = [];
  const doublonsFichier: LigneImportDoublonFichier[] = [];
  const candidats: LigneImportValide[] = [];
  const vusParEmail = new Map<string, number>();
  const vusParTelephone = new Map<string, number>();

  lignesDonnees.forEach((valeurs, indexRelatif) => {
    const numeroLigne = indexRelatif + 2; // décision 10 : en-tête = ligne 1
    const extraire = (champ: ChampParticipant): string => {
      const index = colonnes[champ];
      return index !== undefined ? (valeurs[index] ?? '') : '';
    };

    const resultat = validerChampsParticipant({
      nom: extraire('nom'),
      prenom: extraire('prenom'),
      email: extraire('email'),
      telephone: extraire('telephone'),
      fonction: extraire('fonction'),
      organisation: extraire('organisation'),
    });

    if (resultat.erreur || !resultat.donnees) {
      erreurs.push({ numeroLigne, motif: resultat.erreur ?? 'Ligne invalide.' });
      return;
    }

    const { donnees } = resultat;
    // Doublon intra-fichier : normalisation déjà faite par
    // validerChampsParticipant, comparée AVANT toute résolution en base
    // (décision 2 de l'énoncé).
    const premiereOccurrence =
      (donnees.email ? vusParEmail.get(donnees.email) : undefined) ??
      (donnees.telephone ? vusParTelephone.get(donnees.telephone) : undefined);
    if (premiereOccurrence !== undefined) {
      doublonsFichier.push({ numeroLigne, premiereOccurrenceLigne: premiereOccurrence });
      return;
    }

    if (donnees.email) vusParEmail.set(donnees.email, numeroLigne);
    if (donnees.telephone) vusParTelephone.set(donnees.telephone, numeroLigne);
    candidats.push({ numeroLigne, ...donnees });
  });

  // Déjà inscrits à CE séminaire : résolu en deux requêtes groupées plutôt
  // qu'une par ligne (jusqu'à PLAFOND_LIGNES lignes).
  const emails = [...new Set(candidats.map((c) => c.email).filter((e): e is string => !!e))];
  const telephones = [...new Set(candidats.map((c) => c.telephone).filter((t): t is string => !!t))];

  let participantsExistants: { id: string; email: string | null; telephone: string | null }[] = [];
  if (emails.length > 0 || telephones.length > 0) {
    participantsExistants = await prisma.participant.findMany({
      where: {
        cabinetId,
        OR: [
          ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
          ...(telephones.length > 0 ? [{ telephone: { in: telephones } }] : []),
        ],
      },
      select: { id: true, email: true, telephone: true },
    });
  }

  const idParEmail = new Map(participantsExistants.filter((p) => p.email).map((p) => [p.email as string, p.id]));
  const idParTelephone = new Map(participantsExistants.filter((p) => p.telephone).map((p) => [p.telephone as string, p.id]));
  const idsExistants = [...new Set(participantsExistants.map((p) => p.id))];

  const inscriptionsActives =
    idsExistants.length > 0
      ? await prisma.inscription.findMany({
          where: {
            seminaireId,
            participantId: { in: idsExistants },
            statut: { in: [StatutInscription.CONFIRMEE, StatutInscription.EN_ATTENTE] },
          },
          select: { participantId: true },
        })
      : [];
  const participantsDejaInscrits = new Set(inscriptionsActives.map((i) => i.participantId));

  const lignesValides: LigneImportValide[] = [];
  const dejaInscrites: LigneImportDejaInscrite[] = [];

  for (const candidat of candidats) {
    const participantId =
      (candidat.email ? idParEmail.get(candidat.email) : undefined) ??
      (candidat.telephone ? idParTelephone.get(candidat.telephone) : undefined);
    if (participantId && participantsDejaInscrits.has(participantId)) {
      dejaInscrites.push({ numeroLigne: candidat.numeroLigne, nom: candidat.nom, prenom: candidat.prenom });
    } else {
      lignesValides.push(candidat);
    }
  }

  let apercuId: string | undefined;
  if (lignesValides.length > 0) {
    const enAttente = await prisma.importEnAttente.create({
      data: {
        seminaireId,
        utilisateurId,
        donnees: lignesValides as unknown as Prisma.InputJsonValue,
        expireLe: new Date(Date.now() + DUREE_APERCU_MS),
      },
    });
    apercuId = enAttente.id;
  }

  return { totalLignes: lignesDonnees.length, lignesValides, dejaInscrites, doublonsFichier, erreurs, apercuId };
}

// ------------------------------------------------------------
// Confirmation
// ------------------------------------------------------------

export class CapaciteImportInsuffisanteError extends Error {
  constructor(
    public readonly placesRestantes: number,
    public readonly demandees: number,
  ) {
    super(
      `Il ne reste que ${placesRestantes} place(s) disponible(s) pour ${demandees} nouvelle(s) inscription(s) demandée(s) : import annulé, aucune ligne n'a été écrite.`,
    );
    this.name = 'CapaciteImportInsuffisanteError';
  }
}

export class ApercuImportIntrouvableError extends Error {
  constructor() {
    super("Cet aperçu d'import est introuvable ou a expiré : veuillez réimporter le fichier.");
    this.name = 'ApercuImportIntrouvableError';
  }
}

export interface ResultatImportCsv {
  importes: number;
  dejaInscrits: number;
}

/**
 * Ne rejoue jamais le fichier : relit les lignes déjà validées depuis
 * ImportEnAttente, vérifie qu'il appartient bien au séminaire, au cabinet
 * (jointure) ET à l'utilisateur courant (décision 2 de l'énoncé) avant
 * quoi que ce soit d'autre.
 */
export async function confirmerImportCsv(
  cabinetId: string,
  seminaireId: string,
  utilisateurId: string,
  apercuId: string,
): Promise<ResultatImportCsv | null> {
  const seminaireExiste = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { id: true },
  });
  if (!seminaireExiste) return null;

  const apercu = await prisma.importEnAttente.findFirst({
    where: { id: apercuId, seminaireId, utilisateurId },
  });
  if (!apercu || apercu.expireLe < new Date()) {
    throw new ApercuImportIntrouvableError();
  }

  const lignes = apercu.donnees as unknown as LigneImportValide[];

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM seminaire WHERE id = ${seminaireId} FOR UPDATE`;

    // Ré-vérifie/consomme l'aperçu DANS la transaction (pas seulement avant
    // de l'ouvrir) : protège contre une double confirmation concurrente du
    // même aperçu, qui se sérialise sur le verrou séminaire ci-dessus. La
    // suppression est faite tout de suite mais reste annulable : si la
    // capacité s'avère insuffisante plus bas, TOUTE la transaction — y
    // compris cette suppression — est annulée (rollback), donc l'aperçu
    // reste disponible pour une nouvelle tentative (décision 2). Seul un
    // COMMIT réussi la rend définitive : "usage unique par succès".
    const suppression = await tx.importEnAttente.deleteMany({ where: { id: apercuId, seminaireId, utilisateurId } });
    if (suppression.count === 0) {
      throw new ApercuImportIntrouvableError();
    }

    const seminaire = await tx.seminaire.findUniqueOrThrow({ where: { id: seminaireId } });

    let dejaInscrits = 0;
    const aInscrire: string[] = [];

    for (const ligne of lignes) {
      // eslint-disable-next-line no-await-in-loop
      const participant = await trouverOuCreerParticipant(
        {
          cabinetId,
          nom: ligne.nom,
          prenom: ligne.prenom,
          email: ligne.email,
          telephone: ligne.telephone,
          fonction: ligne.fonction,
          organisation: ligne.organisation,
        },
        tx,
      );
      // eslint-disable-next-line no-await-in-loop
      const inscriptionExistante = await tx.inscription.findUnique({
        where: { seminaireId_participantId: { seminaireId, participantId: participant.id } },
      });
      if (inscriptionExistante && inscriptionExistante.statut !== StatutInscription.ANNULEE) {
        dejaInscrits++;
        continue;
      }
      aInscrire.push(participant.id);
    }

    // Jauge tout-ou-rien (décision 5 de l'énoncé) : seules les lignes qui
    // créeraient une inscription réellement nouvelle comptent — un import
    // plein de gens déjà inscrits doit pouvoir passer même sur un séminaire
    // complet, puisqu'il ne consomme aucune place supplémentaire.
    if (seminaire.capaciteMax !== null) {
      const occupees = await tx.inscription.count({
        where: { seminaireId, statut: { in: [StatutInscription.CONFIRMEE, StatutInscription.EN_ATTENTE] } },
      });
      const placesRestantes = seminaire.capaciteMax - occupees;
      if (aInscrire.length > placesRestantes) {
        throw new CapaciteImportInsuffisanteError(Math.max(0, placesRestantes), aInscrire.length);
      }
    }

    for (const participantId of aInscrire) {
      // eslint-disable-next-line no-await-in-loop
      await inscrireParticipant(
        { seminaireId, participantId, source: SourceInscription.IMPORT, statutCible: StatutInscription.CONFIRMEE },
        tx,
      );
    }

    return { importes: aInscrire.length, dejaInscrits };
  });
}
