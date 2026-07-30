// Séparé de anti-spam.ts (qui importe node:crypto) : ce fichier doit rester
// importable depuis un composant client sans entraîner tout le module
// serveur dans le bundle du navigateur.

// Nom de champ plausible pour un remplissage automatique, absent du vrai
// formulaire : tout bot qui remplit tous les champs visibles s'y fait piéger.
export const NOM_CHAMP_HONEYPOT = 'site_web';

export function estHoneypotRempli(valeur: string | undefined | null): boolean {
  return Boolean(valeur && valeur.trim() !== '');
}
