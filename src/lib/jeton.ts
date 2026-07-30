import { nanoid } from 'nanoid';

// Jeton d'inscription (Règle 1) : long, non deviné, présent dans /p/{jeton}.
export function genererJetonInscription(): string {
  return nanoid(21);
}

// Code public d'un séminaire : plus court, mais toujours non devinable.
export function genererCodePublicSeminaire(): string {
  return nanoid(10);
}
