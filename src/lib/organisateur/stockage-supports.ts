import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Adaptateur de stockage LOCAL (disque du conteneur) — le seul implémenté
 * pour ce lot. Fonctionnel pour la démo, avec une limite connue et
 * documentée (POINTS-OUVERTS.md) : sur le plan gratuit Render, sans disque
 * persistant configuré, ce dossier est perdu à chaque redéploiement. Un
 * futur adaptateur S3 (ou le disque persistant Render) remplacerait ce
 * fichier sans changer l'appelant (lib/organisateur/supports.ts n'appelle
 * que enregistrerFichierSupport/lireFichierSupport, jamais le chemin disque
 * directement).
 */

const DOSSIER_UPLOADS = path.join(process.cwd(), 'uploads');

// Extension courte uniquement, jamais le nom de fichier original réinjecté
// tel quel dans un chemin disque (fourni par le client, potentiellement
// hostile) — bornée en longueur et purgée de tout caractère hors [a-z0-9].
function extensionDepuisNomFichier(nomFichier: string): string {
  const point = nomFichier.lastIndexOf('.');
  if (point === -1) return '';
  const brute = nomFichier.slice(point + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(brute) ? `.${brute}` : '';
}

/**
 * Écrit le fichier sur disque sous un nom généré (jamais le nom original,
 * qui peut contenir des caractères hostiles ou entrer en collision) et
 * renvoie le chemin RELATIF à stocker dans `SupportCours.urlStockage`.
 */
export async function enregistrerFichierSupport(
  seminaireId: string,
  nomFichierOriginal: string,
  contenu: Buffer,
): Promise<string> {
  const dossierSeminaire = path.join(DOSSIER_UPLOADS, seminaireId);
  await mkdir(dossierSeminaire, { recursive: true });

  const nomStocke = `${randomUUID()}${extensionDepuisNomFichier(nomFichierOriginal)}`;
  await writeFile(path.join(dossierSeminaire, nomStocke), contenu);

  return path.posix.join(seminaireId, nomStocke);
}

/**
 * `urlStockage` vient toujours d'une ligne déjà en base, jamais construit à
 * partir d'une entrée utilisateur au moment de la lecture — les deux seules
 * routes qui appellent cette fonction résolvent d'abord un `supportId` en
 * base (avec vérification cabinet/visibilité), jamais un chemin transmis
 * tel quel par le client.
 */
export async function lireFichierSupport(urlStockage: string): Promise<Buffer> {
  return readFile(path.join(DOSSIER_UPLOADS, urlStockage));
}

/**
 * Même chose que lireFichierSupport, mais renvoie `null` plutôt que de
 * lever si le fichier est absent du disque (ENOENT) — cas concret et déjà
 * documenté (voir commentaire d'en-tête) sur le plan gratuit Render : une
 * ligne en base (`logoUrl`/`logoClientUrl`/`cvUrl`...) peut survivre à un
 * redéploiement alors que le fichier qu'elle référence, lui, a disparu avec
 * le disque éphémère. Les routes qui SERVENT un logo/CV directement au
 * navigateur (donc sans page d'erreur applicative pour absorber le cas)
 * utilisent cette version pour répondre proprement 404 plutôt que de
 * planter avec une erreur Node brute. Toute autre erreur (permissions,
 * disque plein...) continue de se propager normalement.
 */
export async function lireFichierSupportOuNull(urlStockage: string): Promise<Buffer | null> {
  try {
    return await lireFichierSupport(urlStockage);
  } catch (erreur) {
    if (erreur instanceof Error && 'code' in erreur && erreur.code === 'ENOENT') return null;
    throw erreur;
  }
}
