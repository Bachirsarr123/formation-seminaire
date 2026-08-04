const FUSEAU = 'Africa/Dakar';

// Fuseau explicitement fixé — jamais celui du navigateur : un participant à
// Dakar et un organisateur ailleurs doivent lire la même heure.
export function formaterDateLongue(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: FUSEAU,
  }).format(date);
}

export function formaterHeure(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSEAU,
  }).format(date);
}

// jj/mm/aaaa — utilisé notamment pour l'export CSV des participants.
export function formaterDateCourte(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: FUSEAU,
  }).format(date);
}
