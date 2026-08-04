import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { prisma } from '@/lib/prisma';
import { FormulaireSeminaire } from '@/components/organisateur/formulaire-seminaire';
import { creerSeminaireAction } from './actions';

export default async function PageNouveauSeminaire() {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const formateurs = await prisma.utilisateur.findMany({
    where: { cabinetId: contexte.cabinetId, role: 'FORMATEUR', actif: true },
    select: { id: true, nom: true, prenom: true },
    orderBy: { nom: 'asc' },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Nouveau séminaire</h1>
      <FormulaireSeminaire action={creerSeminaireAction} formateursDisponibles={formateurs} libelleSoumission="Créer le séminaire" />
    </div>
  );
}
