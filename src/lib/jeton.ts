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
