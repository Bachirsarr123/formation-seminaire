import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirQuestionnairePourEditeur } from '@/lib/questionnaire/editeur';
import { verrouillageEffectif } from '@/lib/questionnaire/verrouillage';
import { prisma } from '@/lib/prisma';
import { LIBELLE_TYPE_QUESTION } from '@/lib/libelles';
import { FormulaireQuestion } from '@/components/organisateur/formulaire-question';
import { FormulaireAjouterSection } from './formulaire-ajouter-section';
import {
  ajouterQuestionAction,
  deplacerQuestionAction,
  deplacerSectionAction,
  dupliquerQuestionnaireAction,
  supprimerQuestionAction,
  supprimerSectionAction,
} from './actions';

interface Props {
  params: Promise<{ id: string }>;
}

const CLASSE_BOUTON_ICONE =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] text-[color:var(--gris-800)]';
const CLASSE_BOUTON_TEXTE =
  'inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]';
const CLASSE_BOUTON_SUPPRIMER = 'min-h-[44px] bg-transparent px-2 text-[length:var(--taille-sm)] text-[color:var(--gris-600)] underline';

// Réservée aux organisateurs — même écran pour un modèle et pour le
// questionnaire d'un séminaire (c'est le même objet en base, voir
// obtenirQuestionnairePourEditeur). Une ressource d'un autre cabinet est
// traitée comme inexistante (règle B), jamais un 403.
export default async function PageEditeurQuestionnaire({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const questionnaire = await obtenirQuestionnairePourEditeur(contexte.cabinetId, id);
  if (!questionnaire) notFound();

  const verrouillage = await verrouillageEffectif(questionnaire.id);

  const modulesDisponibles = questionnaire.seminaireId
    ? await prisma.module.findMany({
        where: { seminaireId: questionnaire.seminaireId },
        select: { id: true, titre: true },
        orderBy: { ordre: 'asc' },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
            {questionnaire.estModele ? questionnaire.nom : questionnaire.titre}
          </h1>
          {questionnaire.estModele ? <p className="text-[color:var(--gris-600)]">{questionnaire.titre}</p> : null}
        </div>
        <a href={`/organisateur/questionnaires/${questionnaire.id}/apercu`} className={CLASSE_BOUTON_TEXTE}>
          Aperçu
        </a>
      </div>

      {verrouillage.structureModifiable ? (
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          {verrouillage.verrouilleLe
            ? "Publié, mais encore modifiable : aucune réponse n'a encore été reçue."
            : 'Encore modifiable — pas encore publié.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
          <p className="text-[color:var(--gris-800)]">Structure figée : au moins une réponse a déjà été reçue.</p>
          <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
            Modifier une question maintenant agrégerait des réponses à des questions différentes dans les mêmes
            moyennes. Pour changer quoi que ce soit, la seule voie est de dupliquer ce questionnaire et de repartir
            d&apos;une nouvelle version modifiable.
          </p>
          <form action={dupliquerQuestionnaireAction.bind(null, questionnaire.id)}>
            <button
              type="submit"
              className="min-h-[44px] self-start rounded-[var(--rayon-sm)] bg-[color:var(--gris-800)] px-4 text-[color:var(--gris-000)]"
            >
              Dupliquer ce questionnaire
            </button>
          </form>
        </div>
      )}

      {questionnaire.sections.length === 0 ? (
        <p className="text-[color:var(--gris-700)]">Aucune section pour l&apos;instant.</p>
      ) : (
        questionnaire.sections.map((section) => (
          <section
            key={section.id}
            className="flex flex-col gap-3 rounded-[var(--rayon-md)] border border-[color:var(--gris-100)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
                  {section.titre}
                </h2>
                {section.description ? <p className="text-[color:var(--gris-600)]">{section.description}</p> : null}
              </div>
              {verrouillage.structureModifiable ? (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={deplacerSectionAction.bind(null, questionnaire.id, section.id, 'HAUT')}>
                    <button type="submit" aria-label="Monter la section" className={CLASSE_BOUTON_ICONE}>
                      ↑
                    </button>
                  </form>
                  <form action={deplacerSectionAction.bind(null, questionnaire.id, section.id, 'BAS')}>
                    <button type="submit" aria-label="Descendre la section" className={CLASSE_BOUTON_ICONE}>
                      ↓
                    </button>
                  </form>
                  <form action={supprimerSectionAction.bind(null, questionnaire.id, section.id)}>
                    <button type="submit" className={CLASSE_BOUTON_SUPPRIMER}>
                      Supprimer la section
                    </button>
                  </form>
                </div>
              ) : null}
            </div>

            {section.questions.length === 0 ? (
              <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Aucune question.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {section.questions.map((question) => (
                  <li
                    key={question.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-[color:var(--gris-900)]">
                        {question.intitule}
                        {question.obligatoire ? <span aria-hidden="true"> *</span> : null}
                      </p>
                      <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                        {LIBELLE_TYPE_QUESTION[question.type]}
                      </p>
                    </div>
                    {verrouillage.structureModifiable ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/organisateur/questionnaires/${questionnaire.id}/questions/${question.id}/modifier`}
                          className={CLASSE_BOUTON_TEXTE}
                        >
                          Modifier
                        </a>
                        <form action={deplacerQuestionAction.bind(null, questionnaire.id, question.id, 'HAUT')}>
                          <button type="submit" aria-label="Monter la question" className={CLASSE_BOUTON_ICONE}>
                            ↑
                          </button>
                        </form>
                        <form action={deplacerQuestionAction.bind(null, questionnaire.id, question.id, 'BAS')}>
                          <button type="submit" aria-label="Descendre la question" className={CLASSE_BOUTON_ICONE}>
                            ↓
                          </button>
                        </form>
                        <form action={supprimerQuestionAction.bind(null, questionnaire.id, question.id)}>
                          <button type="submit" className={CLASSE_BOUTON_SUPPRIMER}>
                            Supprimer
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {verrouillage.structureModifiable ? (
              <FormulaireQuestion
                action={ajouterQuestionAction.bind(null, questionnaire.id, section.id)}
                modulesDisponibles={modulesDisponibles}
                libelleSoumission="Ajouter la question"
              />
            ) : null}
          </section>
        ))
      )}

      {verrouillage.structureModifiable ? <FormulaireAjouterSection questionnaireId={questionnaire.id} /> : null}
    </div>
  );
}
