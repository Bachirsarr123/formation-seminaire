import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalisation appliquée AVANT toute recherche de doublon ou écriture en
 * base. Sans elle, "Awa.Diop@x.sn" et "awa.diop@x.sn" créent deux
 * participants distincts et les relances partent en double.
 */

export function normaliserEmail(email: string | null | undefined): string | null {
  const brut = email?.trim().toLowerCase();
  return brut ? brut : null;
}

// Indicatif Sénégal par défaut : la plupart des numéros saisis sans
// indicatif viennent de participants locaux. Un numéro déjà au format
// international (+...) est parsé tel quel, l'indicatif par défaut ne
// s'applique qu'en son absence.
export function normaliserTelephone(telephone: string | null | undefined): string | null {
  const brut = telephone?.trim();
  if (!brut) return null;

  const numero = parsePhoneNumberFromString(brut, { defaultCountry: 'SN' });
  if (!numero || !numero.isValid()) return null;

  return numero.number; // format E.164, ex. +221771234567
}

export function normaliserNom(valeur: string): string {
  return valeur.trim().replace(/\s+/g, ' ');
}
