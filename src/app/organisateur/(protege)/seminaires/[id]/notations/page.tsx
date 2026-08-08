import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirNotationsSeminaire } from '@/lib/organisateur/notations';
import { LIBELLE_TYPE_NOTATION } from '@/lib/libelles';
import { enregistrerNotationAction } from './actions';
import { FormulaireNotation } from './formulaire-notation';

interface Props {
  params: Promise<{ id: string }>;
}

const CLASSE_BOUTON_TEXTE =
  'inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]';

// Accessible au formateur affecté (lecture + écriture, tant que le
// séminaire n'est pas archivé) et à l'organisateur (lecture seule) — voir
// obtenirNotationsSeminaire, qui applique règle B (cabinet) et l'affectation
// formateur, jamais cette page.
export default async function PageNotations({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur();

  const vue = await obtenirNotationsSeminaire(contexte.cabinetId, id, contexte);
  if (!vue) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="min-w-0 break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
          Notations — {vue.seminaireTitre}
        </h1>
        <div className="flex flex-wrap gap-3">
          <a href={`/organisateur/seminaires/${id}/notations/export.csv`} className={CLASSE_BOUTON_TEXTE}>
            Exporter en CSV
          </a>
          <a href={`/organisateur/seminaires/${id}/notations/export.xlsx`} className={CLASSE_BOUTON_TEXTE}>
            Exporter en Excel
          </a>
        </div>
      </div>

      {!vue.peutNoter ? (
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          {contexte.role === 'FORMATEUR'
            ? "Ce séminaire est archivé : la notation ne peut plus être modifiée."
            : "Lecture seule — seul un formateur affecté à ce séminaire peut noter."}
        </p>
      ) : null}

      {vue.lignes.length === 0 ? (
        <p className="text-[color:var(--gris-700)]">Aucun participant confirmé pour ce séminaire.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {vue.lignes.map((ligne) => (
            <li key={ligne.inscriptionId} className="flex flex-col gap-2 rounded-[var(--rayon-md)] border border-[color:var(--gris-100)] p-4">
              <p className="text-[color:var(--gris-900)]">
                {ligne.participant.prenom} {ligne.participant.nom}
              </p>

              {ligne.notation ? (
                <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                  {LIBELLE_TYPE_NOTATION[ligne.notation.typeNotation]}
                  {ligne.notation.valeur !== null ? (
                    <span className="chiffre">
                      {' '}
                      — {ligne.notation.valeur}/{ligne.notation.bareme}
                    </span>
                  ) : null}
                  {' — '}
                  {ligne.notation.justification}
                  <span className="text-[color:var(--gris-500)]">
                    {' '}
                    (par {ligne.notation.formateurPrenom} {ligne.notation.formateurNom})
                  </span>
                </p>
              ) : (
                <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Non noté</p>
              )}

              {vue.peutNoter ? (
                <FormulaireNotation
                  action={enregistrerNotationAction.bind(null, id, ligne.inscriptionId)}
                  notationExistante={ligne.notation}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
