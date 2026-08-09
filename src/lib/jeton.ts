import { nanoid } from 'nanoid';

// Jeton d'inscription (Règle 1) : long, non deviné, présent dans /p/{jeton}.
export function genererJetonInscription(): string {
  return nanoid(21);
}

// Code public d'un séminaire : plus court, mais toujours non devinable.
export function genererCodePublicSeminaire(): string {
  return nanoid(10);
}

// Lien participant du recueil de besoins — largement diffusé (WhatsApp,
// e-mail), même registre que le code public d'un séminaire.
export function genererCodeAccesRecueil(): string {
  return nanoid(10);
}

// Lien de consultation des réponses nominatives du recueil — un secret au
// même titre qu'un jeton d'inscription (Règle 1) : quiconque le possède voit
// les réponses. Généré indépendamment de codeAcces, jamais dérivé de lui.
export function genererCodeConsultationRecueil(): string {
  return nanoid(21);
}

// Code de suivi d'un message anonyme (lot messages) : contrairement aux
// jetons ci-dessus, celui-ci est SAISI À LA MAIN par un participant qui
// revient consulter une réponse — 12 caractères (alphabet nanoid par défaut,
// ~71 bits d'entropie) reste non devinable tout en étant transcriptible.
// Jamais stocké en clair (voir hacherJeton, lib/organisateur/jeton-hash.ts).
export function genererCodeSuiviMessage(): string {
  return nanoid(12);
}
