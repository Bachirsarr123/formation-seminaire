import { resoudreContexteLienFormateur } from '@/lib/formateur-lien';
import { obtenirNotationsSeminaire } from '@/lib/organisateur/notations';
import { FormulaireNotation } from '@/components/formulaire-notation';
import { enregistrerNotationFormateurAction } from './actions';

interface Props {
  params: Promise<{ codeFormateur: string }>;
}

export default async function PageNotationsFormateur({ params }: Props) {
  const { codeFormateur } = await params;
  const contexte = await resoudreContexteLienFormateur(codeFormateur);

  if (!contexte) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">Ce lien n&apos;est pas valide.</p>
      </main>
    );
  }

  const vue = await obtenirNotationsSeminaire(contexte.cabinetId, contexte.seminaire.id, {
    utilisateurId: contexte.utilisateurId,
    cabinetId: contexte.cabinetId,
    role: 'FORMATEUR',
  });
  // vue est toujours non nul ici : resoudreContexteLienFormateur a déjà
  // vérifié l'affectation via le code lui-même — obtenirNotationsSeminaire
  // ne peut renvoyer null que si cette même affectation manquait.
  if (!vue) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">Ce lien n&apos;est pas valide.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4 pb-12">
      <div>
        <a href={`/f/${codeFormateur}`} className="text-[length:var(--taille-sm)] text-[color:var(--couleur-accent-texte)] underline">
          ← {vue.seminaireTitre}
        </a>
        <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Notations</h1>
      </div>

      {!vue.peutNoter ? (
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Ce séminaire est archivé : la notation ne peut plus être modifiée.
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

              {vue.peutNoter ? (
                <FormulaireNotation
                  action={enregistrerNotationFormateurAction.bind(null, codeFormateur, ligne.inscriptionId)}
                  notationExistante={ligne.notation}
                />
              ) : ligne.notation ? (
                <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Déjà noté.</p>
              ) : (
                <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Non noté.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
