import { redirect } from 'next/navigation';
import { resoudreSessionOrganisateur } from '@/lib/organisateur/session';
import { FormulaireConnexion } from './formulaire-connexion';

export default async function PageConnexion() {
  const contexte = await resoudreSessionOrganisateur();
  if (contexte) redirect('/organisateur');

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Connexion</h1>
      <FormulaireConnexion />
      <div className="flex flex-col gap-2 text-[length:var(--taille-sm)]">
        <a href="/organisateur/connexion/mot-de-passe-oublie" className="text-[color:var(--couleur-accent-texte)] underline">
          Mot de passe oublié ?
        </a>
        <a href="/organisateur/connexion/formateur" className="text-[color:var(--couleur-accent-texte)] underline">
          Vous êtes formateur ? Recevoir un lien de connexion
        </a>
      </div>
    </main>
  );
}
