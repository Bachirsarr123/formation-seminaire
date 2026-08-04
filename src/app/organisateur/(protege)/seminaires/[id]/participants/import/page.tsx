import { notFound } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { PLAFOND_LIGNES } from '@/lib/organisateur/import-participants';
import { FormulaireImportCsv } from './formulaire-import-csv';

interface Props {
  params: Promise<{ id: string }>;
}

// Organisateur uniquement (comme /seminaires/nouveau) : contrairement à la
// liste des participants, cet écran n'a pas de sens en lecture seule pour
// un formateur — exigerContexteOrganisateur lève RoleInsuffisantError sinon.
export default async function PageImportCsv({ params }: Props) {
  const { id } = await params;
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await obtenirSeminaire(contexte.cabinetId, id);
  if (!seminaire) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">
        Importer des participants — {seminaire.titre}
      </h1>
      <p className="text-[color:var(--gris-700)]">
        Fichier CSV avec une ligne d&apos;en-tête (colonnes reconnues : Nom, Prénom, Email, Téléphone, Fonction,
        Organisation — Nom et Prénom obligatoires). {PLAFOND_LIGNES} lignes de données maximum. Rien n&apos;est écrit
        avant confirmation de l&apos;aperçu.
      </p>
      <FormulaireImportCsv seminaireId={id} />
    </div>
  );
}
