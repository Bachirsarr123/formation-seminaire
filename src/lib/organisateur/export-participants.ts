import 'server-only';
import { LIBELLE_SOURCE_INSCRIPTION, LIBELLE_STATUT_INSCRIPTION } from '../libelles';
import { formaterDateCourte } from '../dates';
import { listerInscriptionsSeminaire } from './participants';

const ENTETES = [
  'Nom',
  'Prénom',
  'Email',
  'Téléphone',
  'Fonction',
  'Organisation',
  'Statut',
  'Source',
  "Date d'inscription",
];

// RFC 4180, fait main (pas de nouvelle dépendance pour 9 colonnes) :
// entoure de guillemets si le champ contient le séparateur, un guillemet
// ou un saut de ligne, en doublant les guillemets internes.
function champCsv(valeur: string): string {
  if (/[;"\n\r]/.test(valeur)) {
    return `"${valeur.replace(/"/g, '""')}"`;
  }
  return valeur;
}

/**
 * Génère l'export CSV des inscrits d'un séminaire. `null` si le séminaire
 * n'existe pas ou appartient à un autre cabinet.
 *
 * Deux colonnes volontairement absentes : le jeton (lien personnel secret —
 * jamais dans un fichier qui peut finir sur un poste partagé ou être
 * retransmis) et « a répondu » (n'a pas sa place dans un export qui peut
 * circuler hors de l'application ; voir listerInscriptionsSeminaire, qui ne
 * charge même pas aReponduLe).
 *
 * Séparateur `;` (locale Excel FR, où `,` est le séparateur décimal) ; BOM
 * UTF-8 en tête pour que les accents s'affichent correctement à l'ouverture.
 */
export async function genererCsvInscriptions(cabinetId: string, seminaireId: string): Promise<string | null> {
  const inscriptions = await listerInscriptionsSeminaire(cabinetId, seminaireId);
  if (inscriptions === null) return null;

  const lignes = [ENTETES.join(';')];
  for (const inscription of inscriptions) {
    lignes.push(
      [
        inscription.participant.nom,
        inscription.participant.prenom,
        inscription.participant.email ?? '',
        inscription.participant.telephone ?? '',
        inscription.participant.fonction ?? '',
        inscription.participant.organisation ?? '',
        LIBELLE_STATUT_INSCRIPTION[inscription.statut],
        LIBELLE_SOURCE_INSCRIPTION[inscription.source],
        formaterDateCourte(inscription.dateInscription),
      ]
        .map(champCsv)
        .join(';'),
    );
  }

  const BOM = String.fromCharCode(0xfeff);
  return BOM + lignes.join('\r\n') + '\r\n';
}
