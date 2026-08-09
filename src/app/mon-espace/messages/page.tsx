import type { CSSProperties } from 'react';
import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { AccesIntrouvable } from '@/components/acces-introuvable';
import { consulterReponseAction, envoyerMessageAction } from './actions';
import { FormulaireEnvoyerMessage } from './formulaire-envoyer-message';
import { FormulaireConsulterReponse } from './formulaire-consulter-reponse';

// Accessible dès l'inscription confirmée, sans restriction de phase (contrairement
// au questionnaire, réservé à APRES) : un participant peut avoir un message à
// transmettre avant comme pendant le séminaire, pas seulement une fois terminé.
export default async function PageMessagesAnonymes() {
  const jeton = await lireJetonSession();
  if (!jeton) {
    return <AccesIntrouvable />;
  }

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) {
    return <AccesIntrouvable />;
  }

  const jetons = deriverJetonsAccent(contexte.seminaire.cabinet.couleurPrimaire);

  return (
    <main style={stylesJetonsAccent(jetons) as CSSProperties} className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4 pb-12">
      <header>
        <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Message anonyme</h1>
        <p className="text-[color:var(--gris-600)]">
          Votre identité n&apos;est jamais associée à ce message, y compris par nous. Le code affiché après l&apos;envoi
          est votre seul moyen de retrouver une éventuelle réponse.
        </p>
      </header>

      <section aria-label="Envoyer un message">
        <FormulaireEnvoyerMessage action={envoyerMessageAction} />
      </section>

      <section aria-label="Consulter une réponse" className="flex flex-col gap-2 border-t border-[color:var(--gris-100)] pt-6">
        <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
          Vous avez déjà un code de suivi ?
        </h2>
        <FormulaireConsulterReponse action={consulterReponseAction} />
      </section>
    </main>
  );
}
