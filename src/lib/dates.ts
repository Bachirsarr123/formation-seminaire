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
