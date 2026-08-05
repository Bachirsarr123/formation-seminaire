import { notFound, redirect } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirQuestionnairePourEditeur } from '@/lib/questionnaire/editeur';
import { verrouillageEffectif } from '@/lib/questionnaire/verrouillage';
import { prisma } from '@/lib/prisma';
import { FormulaireQuestion } from '@/components/organisateur/formulaire-question';
import { modifierQuestionAction } from './actions';

interface Props {
  params: Promise<{ id: string; questionId: string }>;
}

export default async function PageModifierQuestion({ params }: Props) {
  const { id, questionId } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const questionnaire = await obtenirQuestionnairePourEditeur(contexte.cabinetId, id);
  if (!questionnaire) notFound();

  const question = questionnaire.sections.flatMap((s) => s.questions).find((q) => q.id === questionId);
  if (!question) notFound();

  // Une modification en cours d'URL directe sur un questionnaire verrouillé
  // entre-temps (autre onglet, autre organisateur) doit renvoyer vers
  // l'éditeur en lecture seule plutôt que d'afficher un formulaire dont la
  // soumission échouerait de toute façon.
  const verrouillage = await verrouillageEffectif(questionnaire.id);
  if (!verrouillage.structureModifiable) redirect(`/organisateur/questionnaires/${id}`);

  const modulesDisponibles = questionnaire.seminaireId
    ? await prisma.module.findMany({
        where: { seminaireId: questionnaire.seminaireId },
        select: { id: true, titre: true },
        orderBy: { ordre: 'asc' },
      })
    : [];

  const action = modifierQuestionAction.bind(null, id, questionId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Modifier la question</h1>
      <FormulaireQuestion
        action={action}
        modulesDisponibles={modulesDisponibles}
        libelleSoumission="Enregistrer les modifications"
        valeursInitiales={{
          intitule: question.intitule,
          description: question.description,
          type: question.type,
          obligatoire: question.obligatoire,
          autoriseSansOpinion: question.autoriseSansOpinion,
          moduleId: question.moduleId,
          options: question.options,
        }}
      />
    </div>
  );
}
