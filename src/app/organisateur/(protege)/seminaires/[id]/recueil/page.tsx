import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { obtenirRecueil } from '@/lib/organisateur/recueil';
import { construireOrigineRequete } from '@/lib/origine-requete';
import { LIBELLE_TYPE_RECUEIL_QUESTION } from '@/lib/libelles';
import { creerRecueilAction } from './actions';
import { FormulaireCreerRecueil } from './formulaire-creer-recueil';
import { BoutonCopier } from '../bouton-copier';

interface Props {
  params: Promise<{ id: string }>;
}

const CLASSE_BOUTON_TEXTE =
  'inline-flex min-h-[44px] items-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[length:var(--taille-sm)] text-[color:var(--gris-800)]';

// Réservée aux organisateurs (même discipline que choisir-modele) : le
// formateur, sans compte de son côté sur ce lot, accède aux réponses par le
// lien de consultation, jamais par cet écran.
export default async function PageRecueil({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) notFound();

  const recueil = await obtenirRecueil(contexte.cabinetId, id);

  if (!recueil) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="min-w-0 break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
          Recueil de besoins — {seminaire.titre}
        </h1>
        <p className="text-[color:var(--gris-700)]">
          Les participants sont déjà inscrits par leur employeur — pas d&apos;inscription à faire ici. Ce formulaire
          nominatif sert à recueillir leurs besoins avant la formation, pour le formateur. Il est indépendant du
          questionnaire d&apos;évaluation.
        </p>
        <FormulaireCreerRecueil action={creerRecueilAction.bind(null, id)} />
      </div>
    );
  }

  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);
  const lienAcces = `${origine}/r/${recueil.codeAcces}`;
  const lienConsultation = `${origine}/rc/${recueil.codeConsultation}`;
  const nbReponses = recueil._count.reponses;

  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0">
        <h1 className="break-words text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">{recueil.titre}</h1>
        <p className="text-[color:var(--gris-600)]">{seminaire.titre}</p>
      </div>

      <p className="text-[color:var(--gris-700)]">{recueil.description}</p>

      <section className="flex flex-col gap-4 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <div className="flex flex-col gap-2">
          <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Lien à diffuser aux participants</p>
          <p className="break-all text-[length:var(--taille-sm)] text-[color:var(--gris-800)]">{lienAcces}</p>
          <BoutonCopier valeur={lienAcces} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
            Lien de consultation à envoyer au formateur — donne accès aux réponses nominatives, à ne pas diffuser au-delà.
          </p>
          <p className="break-all text-[length:var(--taille-sm)] text-[color:var(--gris-800)]">{lienConsultation}</p>
          <BoutonCopier valeur={lienConsultation} libelle="Copier le lien de consultation" />
        </div>
      </section>

      <p className="chiffre text-[color:var(--gris-700)]">
        {nbReponses} réponse{nbReponses > 1 ? 's' : ''} reçue{nbReponses > 1 ? 's' : ''}
      </p>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Questions ({recueil.questions.length})</h2>
          <a href={`/organisateur/seminaires/${id}/recueil/modifier`} className={CLASSE_BOUTON_TEXTE}>
            Modifier les questions
          </a>
        </div>
        {recueil.questions.length === 0 ? (
          <p className="text-[color:var(--gris-700)]">Aucune question pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recueil.questions.map((question) => (
              <li key={question.id} className="text-[color:var(--gris-700)]">
                {question.intitule} <span className="text-[color:var(--gris-500)]">— {LIBELLE_TYPE_RECUEIL_QUESTION[question.type]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
