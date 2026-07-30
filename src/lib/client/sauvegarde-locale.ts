'use client';

const DUREE_VIE_MS = 24 * 60 * 60 * 1000;

interface Enveloppe<T> {
  valeur: T;
  expirationLe: number;
}

/**
 * Brique réutilisable (formulaire d'inscription, puis questionnaire au lot 3) :
 * conserve la saisie en cours côté client pour survivre à un rechargement ou
 * une coupure réseau. Expire au bout de 24h — ces champs contiennent un nom,
 * un e-mail, un téléphone : sur un poste partagé ou un téléphone de
 * cybercafé, ils ne doivent pas traîner indéfiniment. `purger()` doit être
 * appelée dès la soumission réussie (dans ce projet : au montage de la page
 * de confirmation, qui n'est jamais atteinte sans un succès réel).
 */
export function sauvegarder<T>(cle: string, valeur: T): void {
  const enveloppe: Enveloppe<T> = { valeur, expirationLe: Date.now() + DUREE_VIE_MS };
  try {
    window.localStorage.setItem(cle, JSON.stringify(enveloppe));
  } catch {
    // Stockage indisponible (navigation privée, quota plein...) : la
    // sauvegarde locale est un confort, pas une garantie — on abandonne.
  }
}

export function restaurer<T>(cle: string): T | null {
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return null;

    const enveloppe = JSON.parse(brut) as Enveloppe<T>;
    if (Date.now() > enveloppe.expirationLe) {
      window.localStorage.removeItem(cle);
      return null;
    }
    return enveloppe.valeur;
  } catch {
    return null;
  }
}

export function purger(cle: string): void {
  try {
    window.localStorage.removeItem(cle);
  } catch {
    // ignore
  }
}
