import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { obtenirRecueil } from '@/lib/organisateur/recueil';
import { LIBELLE_TYPE_RECUEIL_QUESTION } from '@/lib/libelles';
import { ajouterQuestionRecueilAction, supprimerQuestionRecueilAction } from './actions';
import { FormulaireQuestionRecueil } from './formulaire-question-recueil';

interface Props {
  params: Promise<{ id: string }>;
}

const CLASSE_BOUTON_SUPPRIMER = 'min-h-[44px] bg-transparent px-2 text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline';

export default async function PageModifierRecueil({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) notFound();

  const recueil = await obtenirRecueil(contexte.cabinetId, id);
  if (!recueil) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Questions du recueil</h1>
        <p className="text-[color:var(--gris-600)]">{seminaire.titre}</p>
      </div>

      {recueil.questions.length === 0 ? (
        <p className="text-[color:var(--gris-700)]">Aucune question pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recueil.questions.map((question) => (
            <li
              key={question.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3"
            >
              <div className="min-w-0">
                <p className="break-words text-[color:var(--gris-900)]">{question.intitule}</p>
                <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                  {LIBELLE_TYPE_RECUEIL_QUESTION[question.type]}
                </p>
              </div>
              <form action={supprimerQuestionRecueilAction.bind(null, id, recueil.id, question.id)}>
                <button type="submit" className={CLASSE_BOUTON_SUPPRIMER}>
                  Supprimer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <FormulaireQuestionRecueil action={ajouterQuestionRecueilAction.bind(null, id, recueil.id)} />

      <a href={`/organisateur/seminaires/${id}/recueil`} className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline">
        Retour au recueil
      </a>
    </div>
  );
}
