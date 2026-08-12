import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { prisma } from '@/lib/prisma';
import { FormulaireSeminaire } from '@/components/organisateur/formulaire-seminaire';
import { FormulaireLogoClient } from './formulaire-logo-client';
import { modifierSeminaireAction, televerserLogoClientAction } from './actions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PageModifierSeminaire({ params }: Props) {
  const { id } = await params;
  // Réservé aux organisateurs : un formateur n'a pas de lien vers cette page
  // (fiche séminaire), mais l'accès direct par URL doit aussi être bloqué.
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const [seminaire, formateurs] = await Promise.all([
    obtenirSeminaire(contexte.cabinetId, id),
    prisma.utilisateur.findMany({
      where: { cabinetId: contexte.cabinetId, role: 'FORMATEUR', actif: true },
      select: { id: true, nom: true, prenom: true },
      orderBy: { nom: 'asc' },
    }),
  ]);
  if (!seminaire) notFound();

  const action = modifierSeminaireAction.bind(null, seminaire.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Modifier — {seminaire.titre}</h1>

      <section className="flex flex-col gap-3 rounded-[var(--rayon-md)] bg-[color:var(--gris-050)] p-4">
        <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Logo de l&apos;entreprise cliente</h2>
        <div className="flex items-center gap-3">
          {seminaire.logoClientUrl ? (
            <span className="inline-flex h-[76px] items-center justify-center rounded-[var(--rayon-sm)] bg-[color:var(--gris-000)] px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/s/${seminaire.codePublic}/logo-client?v=${encodeURIComponent(seminaire.logoClientUrl)}`}
                alt=""
                className="h-[60px] w-auto max-w-[200px] object-contain"
              />
            </span>
          ) : (
            <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">Aucun logo téléversé pour l&apos;instant.</p>
          )}
        </div>
        <FormulaireLogoClient
          action={televerserLogoClientAction.bind(null, seminaire.id)}
          aDejaUnLogo={seminaire.logoClientUrl !== null}
        />
      </section>

      <FormulaireSeminaire
        action={action}
        formateursDisponibles={formateurs}
        libelleSoumission="Enregistrer les modifications"
        valeursInitiales={{
          titre: seminaire.titre,
          description: seminaire.description,
          dateDebut: seminaire.dateDebut,
          dateFin: seminaire.dateFin,
          lieu: seminaire.lieu,
          tarif: seminaire.tarif,
          modalite: seminaire.modalite,
          dureeHeures: seminaire.dureeHeures,
          inscriptionOuverte: seminaire.inscriptionOuverte,
          validationRequise: seminaire.validationRequise,
          seuilAnonymat: seminaire.seuilAnonymat,
          modules: seminaire.modules.map((m) => ({ titre: m.titre, dureeMinutes: m.dureeMinutes })),
          formateurs: seminaire.formateurs.map((f) => ({ utilisateurId: f.utilisateurId, roleFormateur: f.roleFormateur })),
        }}
      />
    </div>
  );
}
