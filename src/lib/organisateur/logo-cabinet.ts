import 'server-only';
import { prisma } from '../prisma';
import { enregistrerFichierSupport } from './stockage-supports';

// Logo du cabinet (Cabinet.logoUrl) — même mécanisme que le logo client
// (lib/organisateur/logo-client.ts) : stockage en base (fichier_stocke),
// servi par la route publique /cabinet-logo/{cabinetId} plutôt que rendu
// directement comme URL externe — `logoUrl` ne porte donc que l'id de la
// ligne fichier_stocke, jamais une URL utilisable telle quelle.

export const PLAFOND_TAILLE_LOGO_CABINET_OCTETS = 2 * 1024 * 1024; // 2 Mo

export const TYPES_MIME_LOGO_CABINET_AUTORISES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

/** `null` si le fichier est valide, sinon le message d'erreur à renvoyer tel quel. */
export function erreurLogoCabinetInvalide(typeMime: string, tailleOctets: number): string | null {
  if (!(TYPES_MIME_LOGO_CABINET_AUTORISES as readonly string[]).includes(typeMime)) {
    return 'Le logo doit être une image (JPEG, PNG, GIF ou WebP).';
  }
  if (tailleOctets > PLAFOND_TAILLE_LOGO_CABINET_OCTETS) {
    return `Le logo dépasse la taille maximale autorisée (${PLAFOND_TAILLE_LOGO_CABINET_OCTETS / (1024 * 1024)} Mo).`;
  }
  return null;
}

export async function enregistrerLogoCabinet(cabinetId: string, typeMime: string, contenu: Buffer): Promise<void> {
  const fichierId = await enregistrerFichierSupport(typeMime, contenu);
  await prisma.cabinet.update({ where: { id: cabinetId }, data: { logoUrl: fichierId } });
}
