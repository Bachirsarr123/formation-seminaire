import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { prisma } from '@/lib/prisma';
import { deconnecterAction } from './deconnexion/actions';

// Provisoire : le vrai tableau de bord (liste des séminaires, agenda) arrive
// à l'étape 4. Cette page permet dès maintenant de valider la connexion, la
// résolution de session et la déconnexion de bout en bout.
export default async function PageOrganisateur() {
  const contexte = await exigerContexteOrganisateur();

  const [utilisateur, cabinet] = await Promise.all([
    prisma.utilisateur.findUniqueOrThrow({
      where: { id: contexte.utilisateurId },
      select: { nom: true, prenom: true, email: true },
    }),
    prisma.cabinet.findUniqueOrThrow({ where: { id: contexte.cabinetId }, select: { nom: true } }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">{cabinet.nom}</h1>
      <p className="text-[color:var(--gris-700)]">
        Connecté(e) en tant que {utilisateur.prenom} {utilisateur.nom} ({contexte.role}).
      </p>
      <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-500)]">
        Le tableau de bord (liste des séminaires, agenda) arrive dans une prochaine étape.
      </p>
      <form action={deconnecterAction}>
        <button
          type="submit"
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
        >
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
