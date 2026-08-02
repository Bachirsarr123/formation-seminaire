import type { SeminaireAgenda } from './agenda';

export interface JourGrille {
  date: Date;
  dansLeMois: boolean;
}

export interface BandeauSemaine {
  seminaire: SeminaireAgenda;
  colDebut: number;
  colFin: number;
}

export interface SemaineGrille {
  debut: Date;
  jours: JourGrille[];
  bandeaux: BandeauSemaine[];
}

function debutJournee(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function ajouterJours(date: Date, n: number): Date {
  const resultat = new Date(date);
  resultat.setUTCDate(resultat.getUTCDate() + n);
  return resultat;
}

// Lundi = premier jour de semaine (convention française). getUTCDay() renvoie
// 0 pour dimanche : on ramène à un index où lundi = 0.
function indexJourSemaine(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

/**
 * Découpe le mois en semaines complètes (lundi à dimanche, débordant sur le
 * mois voisin aux extrémités pour ne jamais couper une semaine), et place
 * chaque séminaire chevauchant la semaine sur les colonnes (1 à 8, bornes
 * exclusives pour grid-column) correspondant à ses jours réels. Pas de
 * calcul de « voie » pour les chevauchements : la grille CSS (grid-auto-flow:
 * dense) empile naturellement les bandeaux qui se recouvrent — c'est
 * délibérément une grille simple, pas un moteur de calendrier.
 */
export function construireGrilleMois(annee: number, mois: number, seminaires: SeminaireAgenda[]): SemaineGrille[] {
  const premierDuMois = new Date(Date.UTC(annee, mois - 1, 1));
  const dernierDuMois = new Date(Date.UTC(annee, mois, 0));

  const debutGrille = ajouterJours(premierDuMois, -indexJourSemaine(premierDuMois));
  const finGrille = ajouterJours(dernierDuMois, 6 - indexJourSemaine(dernierDuMois));

  const seminairesNormalises = seminaires.map((s) => ({
    seminaire: s,
    debut: debutJournee(s.dateDebut),
    fin: debutJournee(s.dateFin),
  }));

  const semaines: SemaineGrille[] = [];
  let curseur = debutGrille;

  while (curseur <= finGrille) {
    const jours: JourGrille[] = Array.from({ length: 7 }, (_, i) => {
      const date = ajouterJours(curseur, i);
      return { date, dansLeMois: date.getUTCMonth() === mois - 1 };
    });
    const finSemaine = jours[6]!.date;

    const bandeaux: BandeauSemaine[] = [];
    for (const { seminaire, debut, fin } of seminairesNormalises) {
      if (fin < curseur || debut > finSemaine) continue;

      const debutClampe = debut < curseur ? curseur : debut;
      const finClampe = fin > finSemaine ? finSemaine : fin;
      const colDebut = Math.round((debutClampe.getTime() - curseur.getTime()) / 86_400_000) + 1;
      const colFin = Math.round((finClampe.getTime() - curseur.getTime()) / 86_400_000) + 2;

      bandeaux.push({ seminaire, colDebut, colFin });
    }

    semaines.push({ debut: curseur, jours, bandeaux });
    curseur = ajouterJours(curseur, 7);
  }

  return semaines;
}
