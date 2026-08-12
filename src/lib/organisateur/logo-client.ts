import 'server-only';
import { prisma } from '../prisma';
import { enregistrerFichierSupport } from './stockage-supports';

// Logo de l'entreprise cliente (Seminaire.logoClientUrl), distinct du logo du
// cabinet (Cabinet.logoUrl, externe) — mêmes contraintes que les supports de
// cours, mêmes adaptateur/dossier de stockage local
// (lib/organisateur/stockage-supports.ts), simplement un type de fichier plus
// restreint (image uniquement) et une taille plus basse.

export const PLAFOND_TAILLE_LOGO_OCTETS = 2 * 1024 * 1024; // 2 Mo

export const TYPES_MIME_LOGO_AUTORISES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

/** `null` si le fichier est valide, sinon le message d'erreur à renvoyer tel quel. */
export function erreurLogoClientInvalide(typeMime: string, tailleOctets: number): string | null {
  if (!(TYPES_MIME_LOGO_AUTORISES as readonly string[]).includes(typeMime)) {
    return 'Le logo doit être une image (JPEG, PNG, GIF ou WebP).';
  }
  if (tailleOctets > PLAFOND_TAILLE_LOGO_OCTETS) {
    return `Le logo dépasse la taille maximale autorisée (${PLAFOND_TAILLE_LOGO_OCTETS / (1024 * 1024)} Mo).`;
  }
  return null;
}

/**
 * `seminaireId` vient toujours d'un séminaire déjà créé/vérifié appartenir
 * au cabinet courant par l'appelant (creerSeminaireAction/modifierSeminaireAction)
 * — pas de re-vérification cabinetId ici, même découpage que
 * enregistrerFichierSupport/lireFichierSupport (stockage-supports.ts).
 */
export async function enregistrerLogoClient(seminaireId: string, nomFichier: string, contenu: Buffer): Promise<void> {
  const urlStockage = await enregistrerFichierSupport(seminaireId, nomFichier, contenu);
  await prisma.seminaire.update({ where: { id: seminaireId }, data: { logoClientUrl: urlStockage } });
}
