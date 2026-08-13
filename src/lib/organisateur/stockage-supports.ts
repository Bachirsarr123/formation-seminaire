import 'server-only';
import { prisma } from '../prisma';

/**
 * Adaptateur de stockage EN BASE (table `fichier_stocke`, colonne bytea) —
 * remplace l'ancien stockage sur disque local (`uploads/`), perdu à chaque
 * redéploiement sur le plan gratuit Render (disque éphémère du conteneur,
 * voir POINTS-OUVERTS.md). Une ligne Postgres/Neon survit aux
 * redéploiements comme n'importe quelle autre donnée applicative — c'est
 * tout l'intérêt de ce changement.
 *
 * Partagé par les quatre fonctionnalités qui téléversent un fichier
 * (supports de cours, logo cabinet, logo client, CV formateur) : chacune
 * plafonne elle-même la taille acceptée (10 Mo au plus, voir
 * PLAFOND_TAILLE_* dans supports.ts/logo-cabinet.ts/logo-client.ts/
 * cv-formateur.ts) et valide son propre type MIME avant d'appeler
 * `enregistrerFichierSupport` — cet adaptateur ne revalide rien, il stocke
 * tel quel ce qu'on lui donne.
 *
 * Les colonnes qui référencent un fichier (`SupportCours.urlStockage`,
 * `Cabinet.logoUrl`, `Seminaire.logoClientUrl`, `Utilisateur.cvUrl`)
 * portent l'id (uuid) de la ligne `FichierStocke` correspondante — plus un
 * chemin disque, mais toujours un simple `String`, donc aucun changement
 * de schéma nécessaire sur ces tables-là.
 */

export interface FichierLu {
  contenu: Buffer;
  typeMime: string;
}

/** Écrit le fichier en base et renvoie l'id de la ligne `FichierStocke` créée. */
export async function enregistrerFichierSupport(typeMime: string, contenu: Buffer): Promise<string> {
  const fichier = await prisma.fichierStocke.create({
    data: { contenu, typeMime, tailleFichier: contenu.byteLength },
    select: { id: true },
  });
  return fichier.id;
}

/**
 * `fichierId` vient toujours d'une colonne déjà en base (jamais construit à
 * partir d'une entrée utilisateur au moment de la lecture) — les appelants
 * résolvent d'abord la ligne parente (support/cabinet/séminaire/compte)
 * avec leurs propres vérifications d'accès, jamais un id transmis tel quel
 * par le client.
 */
export async function lireFichierSupport(fichierId: string): Promise<FichierLu> {
  const fichier = await prisma.fichierStocke.findUniqueOrThrow({
    where: { id: fichierId },
    select: { contenu: true, typeMime: true },
  });
  return { contenu: Buffer.from(fichier.contenu), typeMime: fichier.typeMime };
}

/**
 * Même chose que lireFichierSupport, mais renvoie `null` plutôt que de
 * lever si la ligne n'existe plus — cas concret pour toute référence
 * héritée de l'ancien stockage disque (chemin relatif, jamais un id de
 * cette table) : une colonne `logoUrl`/`cvUrl`/`urlStockage` posée avant ce
 * lot ne correspondra plus jamais à rien ici, et doit rendre un
 * « introuvable » propre plutôt qu'une erreur brute.
 */
export async function lireFichierSupportOuNull(fichierId: string): Promise<FichierLu | null> {
  const fichier = await prisma.fichierStocke.findUnique({
    where: { id: fichierId },
    select: { contenu: true, typeMime: true },
  });
  if (!fichier) return null;
  return { contenu: Buffer.from(fichier.contenu), typeMime: fichier.typeMime };
}
