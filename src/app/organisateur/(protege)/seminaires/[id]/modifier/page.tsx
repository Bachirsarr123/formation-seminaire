import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { prisma } from '@/lib/prisma';
import { FormulaireSeminaire } from '@/components/organisateur/formulaire-seminaire';
import { modifierSeminaireAction } from './actions';

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
          modalite: seminaire.modalite,
          dureeHeures: seminaire.dureeHeures,
          capaciteMax: seminaire.capaciteMax,
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
