import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { listerMessagesAnonymes } from '@/lib/anonymat';
import { LIBELLE_STATUT_MESSAGE } from '@/lib/libelles';
import { formaterDateLongue } from '@/lib/dates';
import { marquerMessageLuAction, marquerMessageTraiteAction, repondreMessageAction } from './actions';
import { FormulaireReponseMessage } from './formulaire-reponse-message';

interface Props {
  params: Promise<{ id: string }>;
}

// Réservée à l'organisateur (comme Recueil, Supports, Modifier) — un
// formateur n'a pas accès à ce canal, même en lecture : voir estFormateur
// dans la fiche séminaire, qui n'affiche le lien vers cette page que pour
// l'organisateur.
export default async function PageMessagesAnonymes({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) notFound();

  const vue = await listerMessagesAnonymes(seminaire.id, seminaire.seuilAnonymat);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="min-w-0 break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
        Messages anonymes — {seminaire.titre}
      </h1>

      {!vue.visible ? (
        <p className="text-[color:var(--gris-700)]">
          {vue.total === 0
            ? "Aucun message pour l'instant."
            : `${vue.total} message${vue.total > 1 ? 's' : ''} reçu${vue.total > 1 ? 's' : ''}, mais pas encore visibles : le seuil d'anonymat de ce séminaire est fixé à ${seminaire.seuilAnonymat}.`}
        </p>
      ) : vue.messages.length === 0 ? (
        <p className="text-[color:var(--gris-700)]">Aucun message pour l&apos;instant.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {vue.messages.map((message) => {
            const repondre = repondreMessageAction.bind(null, seminaire.id, message.id);
            const marquerLu = marquerMessageLuAction.bind(null, seminaire.id, message.id);
            const marquerTraite = marquerMessageTraiteAction.bind(null, seminaire.id, message.id);

            return (
              <li key={message.id} className="flex flex-col gap-3 rounded-[var(--rayon-md)] border border-[color:var(--gris-100)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                    {formaterDateLongue(message.jourEnvoi)}
                  </span>
                  <span className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
                    {LIBELLE_STATUT_MESSAGE[message.statut]}
                  </span>
                </div>

                <p className="text-[color:var(--gris-900)]">{message.contenu}</p>

                {message.reponseOrganisateur ? (
                  <p className="rounded-[var(--rayon-sm)] bg-[color:var(--gris-050)] p-3 text-[color:var(--gris-800)]">
                    <span className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Votre réponse : </span>
                    {message.reponseOrganisateur}
                  </p>
                ) : (
                  <FormulaireReponseMessage action={repondre} />
                )}

                <div className="flex flex-wrap gap-3">
                  {message.statut === 'NOUVEAU' ? (
                    <form action={marquerLu}>
                      <button
                        type="submit"
                        className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]"
                      >
                        Marquer comme lu
                      </button>
                    </form>
                  ) : null}
                  {message.statut !== 'TRAITE' ? (
                    <form action={marquerTraite}>
                      <button
                        type="submit"
                        className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]"
                      >
                        Marquer comme traité
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
