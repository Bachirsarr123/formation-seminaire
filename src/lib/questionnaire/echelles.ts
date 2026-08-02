import type { TypeQuestion } from '@prisma/client';

export type TypeEchelle = 'NOTE_5' | 'NOTE_10' | 'ECHELLE_4' | 'NPS';

export const TYPES_ECHELLE: readonly TypeEchelle[] = ['NOTE_5', 'NOTE_10', 'ECHELLE_4', 'NPS'];

export function estTypeEchelle(type: TypeQuestion): type is TypeEchelle {
  return (TYPES_ECHELLE as readonly string[]).includes(type);
}

/** Bornes fixes par type — pas de colonne dédiée, la borne est portée par l'énumération elle-même. */
export const BORNES_ECHELLE: Record<TypeEchelle, { min: number; max: number }> = {
  NOTE_5: { min: 1, max: 5 },
  NOTE_10: { min: 1, max: 10 },
  ECHELLE_4: { min: 1, max: 4 },
  // NPS est toujours 0–10 par définition (Net Promoter Score), jamais 1–10.
  NPS: { min: 0, max: 10 },
};

/** Libellés d'extrémité affichés sous la rangée pour NPS (fixes, non stockés en base). */
export const LIBELLES_EXTREMITES_NPS = { min: 'Peu probable', max: 'Très probable' } as const;

/**
 * ECHELLE_4 (Likert forcé) exige un intitulé par valeur — un chiffre nu ne
 * veut rien dire pour le répondant. Convention de `question.options` (Json) :
 *   { libelles: { "1": "...", "2": "...", "3": "...", "4": "..." } }
 */
export interface OptionsEchelle4 {
  libelles: Record<'1' | '2' | '3' | '4', string>;
}

export function libellesEchelle4(options: unknown): OptionsEchelle4['libelles'] | null {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return null;
  const libelles = (options as Record<string, unknown>).libelles;
  if (!libelles || typeof libelles !== 'object' || Array.isArray(libelles)) return null;
  const brut = libelles as Record<string, unknown>;
  if (!['1', '2', '3', '4'].every((cle) => typeof brut[cle] === 'string')) return null;
  return brut as OptionsEchelle4['libelles'];
}

/** Convention de `question.options` (Json) pour QCM_UNIQUE/QCM_MULTIPLE. */
export interface OptionsQcm {
  choix: { id: string; libelle: string }[];
}

export function choixQcm(options: unknown): OptionsQcm['choix'] {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return [];
  const choix = (options as Record<string, unknown>).choix;
  return Array.isArray(choix) ? (choix as OptionsQcm['choix']) : [];
}

/**
 * Valeur de formulaire réservée à la case « Sans opinion » (input radio du
 * même groupe que les valeurs numériques — mutuellement exclusive nativement,
 * sans JavaScript). Distincte de « pas répondu » : enregistre une Reponse
 * réelle avec valeurNumerique null et ce marqueur dans valeurOptions, jamais
 * une absence de ligne.
 */
export const VALEUR_FORMULAIRE_SANS_OPINION = 'sans-opinion';
export const MARQUEUR_SANS_OPINION = { sansOpinion: true } as const;

export function estMarqueurSansOpinion(valeurOptions: unknown): boolean {
  return (
    !!valeurOptions &&
    typeof valeurOptions === 'object' &&
    !Array.isArray(valeurOptions) &&
    (valeurOptions as Record<string, unknown>).sansOpinion === true
  );
}
