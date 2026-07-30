const HOTES_LOCAUX_AUTORISES = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Garde-fou pour tout script destructeur ou générateur de données de test
 * (seed, reset de base...). Un `migrate reset --force` — ou un seed qui
 * recrée des fixtures par-dessus des données réelles — lancé par erreur en
 * production détruirait des évaluations irrécupérables : les soumissions ne
 * sont rattachées à personne (Règle 2), donc impossible à reconstituer ou à
 * réconcilier après coup.
 *
 * Ne journalise jamais `DATABASE_URL` en entier (contient le mot de passe) :
 * seul le nom d'hôte extrait apparaît dans les messages.
 */
export function verifierEnvironnementDev(nomScript: string): void {
  if (process.env.NODE_ENV === 'production') {
    console.error(`[${nomScript}] Refusé : NODE_ENV=production. Ce script est réservé au développement local.`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(`[${nomScript}] Refusé : DATABASE_URL n'est pas défini.`);
    process.exit(1);
  }

  let hote: string;
  try {
    hote = new URL(databaseUrl).hostname;
  } catch {
    console.error(`[${nomScript}] Refusé : DATABASE_URL n'est pas une URL valide.`);
    process.exit(1);
    return;
  }

  if (!HOTES_LOCAUX_AUTORISES.has(hote)) {
    console.error(
      `[${nomScript}] Refusé : DATABASE_URL pointe vers "${hote}", pas localhost/127.0.0.1.\n` +
        `Ce script détruit ou remplace des données. Il ne doit jamais tourner contre une base distante.`,
    );
    process.exit(1);
  }
}
