export type PhaseSeminaire = 'AVANT' | 'PENDANT' | 'APRES';

export function calculerPhaseSeminaire(
  dateDebut: Date,
  dateFin: Date,
  maintenant: Date = new Date(),
): PhaseSeminaire {
  if (maintenant < dateDebut) return 'AVANT';
  if (maintenant > dateFin) return 'APRES';
  return 'PENDANT';
}
