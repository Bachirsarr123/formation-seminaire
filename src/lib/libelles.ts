import type { Modalite, SourceInscription, StatutInscription, StatutSeminaire } from '@prisma/client';

// Record<Enum, string> plutôt que Record<string, string> : sous
// noUncheckedIndexedAccess (tsconfig), un index signature générique renvoie
// `string | undefined` même pour une clé d'énum valide — une clé exacte
// comme ci-dessous reste `string`, sans caster ni ajouter de garde inutile
// à chaque site d'appel.
export const LIBELLE_MODALITE: Record<Modalite, string> = {
  PRESENTIEL: 'Présentiel',
  DISTANCIEL: 'Distanciel',
  HYBRIDE: 'Hybride',
};

export const LIBELLE_STATUT_SEMINAIRE: Record<StatutSeminaire, string> = {
  BROUILLON: 'Brouillon',
  PUBLIE: 'Publié',
  EN_COURS: 'En cours',
  CLOTURE: 'Clôturé',
  ARCHIVE: 'Archivé',
};

export const LIBELLE_STATUT_INSCRIPTION: Record<StatutInscription, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

export const LIBELLE_SOURCE_INSCRIPTION: Record<SourceInscription, string> = {
  IMPORT: 'Import',
  MANUEL: 'Manuel',
  AUTO_INSCRIPTION: 'Auto-inscription',
};
