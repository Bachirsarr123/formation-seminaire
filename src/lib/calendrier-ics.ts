interface EvenementIcs {
  uid: string;
  titre: string;
  description?: string | null;
  lieu?: string | null;
  dateDebut: Date;
  dateFin: Date;
}

function formatDateIcs(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function echapperTexteIcs(valeur: string): string {
  return valeur.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Contenu public uniquement (titre/dates/lieu) : aucune donnée participant,
// donc pas besoin d'authentifier le téléchargement.
export function genererIcs(evenement: EvenementIcs): string {
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plateforme Seminaires//FR',
    'BEGIN:VEVENT',
    `UID:${evenement.uid}`,
    `DTSTAMP:${formatDateIcs(new Date())}`,
    `DTSTART:${formatDateIcs(evenement.dateDebut)}`,
    `DTEND:${formatDateIcs(evenement.dateFin)}`,
    `SUMMARY:${echapperTexteIcs(evenement.titre)}`,
    ...(evenement.description ? [`DESCRIPTION:${echapperTexteIcs(evenement.description)}`] : []),
    ...(evenement.lieu ? [`LOCATION:${echapperTexteIcs(evenement.lieu)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lignes.join('\r\n');
}
