import type { Modalite, SourceInscription, StatutInscription, StatutSeminaire, TypeQuestion } from '@prisma/client';

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

export const LIBELLE_TYPE_QUESTION: Record<TypeQuestion, string> = {
  NOTE_5: 'Note sur 5',
  NOTE_10: 'Note sur 10',
  ECHELLE_4: 'Échelle à 4 niveaux',
  QCM_UNIQUE: 'Choix unique',
  QCM_MULTIPLE: 'Choix multiple',
  TEXTE_LIBRE: 'Texte libre',
  OUI_NON: 'Oui / Non',
  NPS: 'Recommandation (NPS)',
};
