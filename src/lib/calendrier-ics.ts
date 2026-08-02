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

function lignesEvenement(evenement: EvenementIcs): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${evenement.uid}`,
    `DTSTAMP:${formatDateIcs(new Date())}`,
    `DTSTART:${formatDateIcs(evenement.dateDebut)}`,
    `DTEND:${formatDateIcs(evenement.dateFin)}`,
    `SUMMARY:${echapperTexteIcs(evenement.titre)}`,
    ...(evenement.description ? [`DESCRIPTION:${echapperTexteIcs(evenement.description)}`] : []),
    ...(evenement.lieu ? [`LOCATION:${echapperTexteIcs(evenement.lieu)}`] : []),
    'END:VEVENT',
  ];
}

// Contenu public uniquement (titre/dates/lieu) : aucune donnée participant,
// donc pas besoin d'authentifier le téléchargement.
export function genererIcs(evenement: EvenementIcs): string {
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Plateforme Seminaires//FR', ...lignesEvenement(evenement), 'END:VCALENDAR'];
  return lignes.join('\r\n');
}

// Flux d'abonnement (agenda du cabinet, lot 4) : plusieurs VEVENT dans un
// seul VCALENDAR — c'est ainsi qu'Outlook/Google Agenda affichent tous les
// séminaires d'un même flux. Mêmes garanties que genererIcs : uniquement
// titre/dates/lieu, jamais de donnée participant ni le codePublic (l'URL de
// ce flux est elle-même un secret de longue durée — pas la peine d'y ajouter
// un lien vers la page publique).
export function genererIcsMultiple(evenements: EvenementIcs[]): string {
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plateforme Seminaires//FR',
    ...evenements.flatMap(lignesEvenement),
    'END:VCALENDAR',
  ];
  return lignes.join('\r\n');
}
