// Jamais une page d'erreur : une invitation à agir. Utilisé par /mon-espace
// et la confirmation d'inscription quand aucun cookie de session valide
// n'est présent (AC : « sans cookie valide → page invitant à réutiliser le
// lien reçu, pas une 500 »).
export function AccesIntrouvable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">
        Nous ne retrouvons pas votre accès sur cet appareil.
      </p>
      <p className="text-[color:var(--gris-600)]">
        Utilisez le lien personnel reçu lors de votre inscription pour revenir ici — il fonctionne à tout moment, y
        compris sur un nouvel appareil.
      </p>
    </main>
  );
}
