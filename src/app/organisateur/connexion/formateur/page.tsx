import { FormulaireLienMagique } from './formulaire-lien-magique';

export default function PageConnexionFormateur() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Connexion formateur</h1>
      <p className="text-[color:var(--gris-600)]">
        Recevez un lien de connexion à usage unique — aucun mot de passe n&apos;est nécessaire.
      </p>
      <FormulaireLienMagique />
    </main>
  );
}
