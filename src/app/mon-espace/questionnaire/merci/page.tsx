import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { prisma } from '@/lib/prisma';
import { AccesIntrouvable } from '@/components/acces-introuvable';
import { PurgeSauvegardeLocale } from './purge-sauvegarde-locale';

export default async function PageMerciQuestionnaire() {
  const jeton = await lireJetonSession();
  if (!jeton) return <AccesIntrouvable />;

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) return <AccesIntrouvable />;

  // Vérité en base à chaque chargement, dans les deux sens : cette page
  // n'affiche jamais de remerciement pour une réponse qui n'a pas eu lieu —
  // sinon quelqu'un arrivant ici sans avoir répondu (URL tapée à la main)
  // verrait un faux écran de confirmation.
  if (!contexte.inscription.aRepondu) {
    redirect('/mon-espace/questionnaire');
  }

  const jetons = deriverJetonsAccent(contexte.seminaire.cabinet.couleurPrimaire);
  const style = stylesJetonsAccent(jetons) as CSSProperties;

  const questionnaire = await prisma.questionnaire.findFirst({
    where: { seminaireId: contexte.seminaire.id, supprimeLe: null, statut: { in: ['PUBLIE', 'FERME'] } },
    select: { id: true },
  });

  return (
    <main style={style} className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-4 text-center">
      {questionnaire ? <PurgeSauvegardeLocale cle={`questionnaire-${questionnaire.id}`} /> : null}
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Merci d&apos;avoir répondu.</h1>
      <p className="text-[color:var(--gris-600)]">Vos réponses ont bien été enregistrées.</p>
    </main>
  );
}
