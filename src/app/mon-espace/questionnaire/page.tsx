import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { calculerPhaseSeminaire } from '@/lib/phase-seminaire';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { prisma } from '@/lib/prisma';
import { AccesIntrouvable } from '@/components/acces-introuvable';
import { nomChampQuestion } from '@/lib/questionnaire/validation-reponses';
import { FormulaireQuestionnaire } from './formulaire-questionnaire';

export default async function PageQuestionnaire() {
  const jeton = await lireJetonSession();
  if (!jeton) return <AccesIntrouvable />;

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) return <AccesIntrouvable />;

  // Vérité en base à chaque chargement : un aRepondu déjà posé (y compris en
  // revenant ici via le bouton précédent du navigateur après succès) renvoie
  // systématiquement vers l'écran de remerciement, jamais vers le formulaire.
  if (contexte.inscription.aRepondu) {
    redirect('/mon-espace/questionnaire/merci');
  }

  const jetons = deriverJetonsAccent(contexte.seminaire.cabinet.couleurPrimaire);
  const style = stylesJetonsAccent(jetons) as CSSProperties;

  const phase = calculerPhaseSeminaire(contexte.seminaire.dateDebut, contexte.seminaire.dateFin);
  if (phase !== 'APRES') {
    return <MessageIndisponible style={style} titre={contexte.seminaire.titre} message="Le questionnaire d'évaluation sera bientôt disponible ici." />;
  }

  const questionnaire = await prisma.questionnaire.findFirst({
    where: { seminaireId: contexte.seminaire.id, statut: 'PUBLIE', supprimeLe: null },
    include: {
      sections: {
        orderBy: { ordre: 'asc' },
        include: { questions: { where: { supprimeLe: null }, orderBy: { ordre: 'asc' } } },
      },
    },
  });

  if (!questionnaire) {
    return <MessageIndisponible style={style} titre={contexte.seminaire.titre} message="Le questionnaire d'évaluation sera bientôt disponible ici." />;
  }

  if (questionnaire.dateLimite && questionnaire.dateLimite < new Date()) {
    return (
      <MessageIndisponible
        style={style}
        titre={contexte.seminaire.titre}
        message="Le délai pour répondre à ce questionnaire est passé."
      />
    );
  }

  const questions = questionnaire.sections.flatMap((section) => section.questions);
  const champs = questions.map((question) => nomChampQuestion(question.id));

  return (
    <div style={style}>
      <FormulaireQuestionnaire
        titreSeminaire={contexte.seminaire.titre}
        questionnaireId={questionnaire.id}
        sections={questionnaire.sections}
        champs={champs}
      />
    </div>
  );
}

function MessageIndisponible({ style, titre, message }: { style: CSSProperties; titre: string; message: string }) {
  return (
    <main style={style} className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">{titre}</h1>
      <p className="text-[color:var(--gris-600)]">{message}</p>
    </main>
  );
}
