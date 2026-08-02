'use client';

/**
 * Limite de segment pour tout /organisateur/* : capte notamment
 * RoleInsuffisantError (lib/organisateur/session.ts) — être connecté et ne
 * pas avoir le rôle requis pour une action donnée n'est pas une faille
 * d'isolation entre cabinets (ça, c'est un 404, jamais un message clair) :
 * ici la personne est dans SON cabinet, juste pas avec le bon rôle, ce qui
 * peut s'expliquer sans rien révéler d'un autre cabinet.
 */
export default function ErreurOrganisateur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const roleInsuffisant = error.name === 'RoleInsuffisantError';

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">
        {roleInsuffisant ? "Vous n'avez pas les droits nécessaires" : 'Une erreur est survenue'}
      </h1>
      <p className="text-[color:var(--gris-600)]">
        {roleInsuffisant
          ? "Cette action est réservée aux organisateurs."
          : 'Réessayez, ou revenez plus tard si le problème persiste.'}
      </p>
      {!roleInsuffisant ? (
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-[44px] rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-4 text-[color:var(--gris-800)]"
        >
          Réessayer
        </button>
      ) : null}
    </main>
  );
}
