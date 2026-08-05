import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirQuestionnairePourEditeur } from '@/lib/questionnaire/editeur';
import { Question } from '@/components/questionnaire/question';

interface Props {
  params: Promise<{ id: string }>;
}

// Le questionnaire tel que le participant le verra — sans aperçu, personne
// ne se rend compte qu'il vient d'écrire vingt questions. `<fieldset
// disabled>` rend tous les champs non interactifs sans toucher au composant
// Question lui-même (celui déjà utilisé côté participant, mon-espace/
// questionnaire) : aucune saisie, aucune soumission possible depuis ici.
export default async function PageApercuQuestionnaire({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const questionnaire = await obtenirQuestionnairePourEditeur(contexte.cabinetId, id);
  if (!questionnaire) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Aperçu</h1>
        <p className="text-[color:var(--gris-600)]">
          Ce que verra un participant — lecture seule, rien n&apos;est modifiable ni envoyable depuis cet écran.
        </p>
      </div>

      <fieldset disabled className="flex flex-col gap-8">
        {questionnaire.sections.map((section) => (
          <section key={section.id} className="flex flex-col gap-6">
            <h2 className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">{section.titre}</h2>
            {section.description ? <p className="text-[color:var(--gris-600)]">{section.description}</p> : null}
            {section.questions.map((question) => (
              <Question key={question.id} question={question} />
            ))}
          </section>
        ))}
      </fieldset>

      <a
        href={`/organisateur/questionnaires/${id}`}
        className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]"
      >
        ← Retour à l&apos;éditeur
      </a>
    </div>
  );
}
