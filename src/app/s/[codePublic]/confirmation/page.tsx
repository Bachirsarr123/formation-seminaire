import type { CSSProperties } from 'react';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { lireJetonSession } from '@/lib/session';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { construireOrigineRequete } from '@/lib/origine-requete';
import { deriverJetonsAccent, stylesJetonsAccent } from '@/lib/design/couleur-accent';
import { AccesIntrouvable } from '@/components/acces-introuvable';
import { BoutonCopier } from './bouton-copier';
import { PurgerBrouillon } from './purger-brouillon';

interface Props {
  searchParams: Promise<{ situation?: string }>;
}

function titrePourEtat(statutInscription: string, situation: string | undefined): string {
  if (statutInscription === 'EN_ATTENTE') return 'Votre inscription est enregistrée';
  if (situation === 'dejaActive') return 'Vous êtes déjà inscrit(e) à ce séminaire';
  return 'Inscription confirmée';
}

export default async function PageConfirmation({ searchParams }: Props) {
  const { situation } = await searchParams;
  const jeton = await lireJetonSession();

  if (!jeton) {
    return <AccesIntrouvable />;
  }

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) {
    return <AccesIntrouvable />;
  }

  const enTetes = await headers();
  const origine = construireOrigineRequete(enTetes);
  const lienPersonnel = `${origine}/p/${jeton}`;
  const qrSvg = await QRCode.toString(lienPersonnel, { type: 'svg', margin: 1, width: 180 });

  const jetons = deriverJetonsAccent(contexte.seminaire.cabinet.couleurPrimaire);

  return (
    <main style={stylesJetonsAccent(jetons) as CSSProperties} className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4 pb-12">
      <PurgerBrouillon />

      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
        {titrePourEtat(contexte.inscription.statut, situation)}
      </h1>

      {contexte.inscription.statut === 'EN_ATTENTE' ? (
        <p className="text-[color:var(--gris-700)]">
          Elle doit être validée par l&apos;organisateur avant confirmation définitive. Vous recevrez votre accès dès
          que ce sera fait.
        </p>
      ) : (
        <p className="text-[color:var(--gris-700)]">
          Voici votre accès personnel — conservez-le, il vous resservira pour retrouver votre espace à tout moment.
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <p className="break-all text-[length:var(--taille-sm)] text-[color:var(--gris-800)]">{lienPersonnel}</p>
        <div className="flex flex-wrap items-center gap-3">
          <BoutonCopier lien={lienPersonnel} />
          {/* Le SVG généré par la lib QRCode porte une largeur fixe (180) codée
              dans son markup — un élément remplacé dans une ligne flex ne
              rétrécit pas sous cette taille par défaut, d'où un débordement
              horizontal à fort zoom même sur un viewport large. */}
          {/* eslint-disable-next-line react/no-danger */}
          <div className="[&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} aria-hidden="true" />
        </div>
      </div>

      <a
        href={`/s/${contexte.seminaire.codePublic}/calendrier.ics`}
        className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 py-3 text-center text-[color:var(--gris-800)]"
      >
        Ajouter à mon calendrier
      </a>
    </main>
  );
}
