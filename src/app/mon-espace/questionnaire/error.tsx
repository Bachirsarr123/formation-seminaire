'use client';

/**
 * Limite de segment Next.js : capte un échec réseau du Server Action de
 * soumission (fetch interne à useActionState). `reset()` réaffiche le
 * formulaire — les réponses ne sont pas perdues, elles sont restaurées depuis
 * la sauvegarde locale au remontage (voir formulaire-questionnaire.tsx).
 */
export default function ErreurQuestionnaire({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">Une erreur de connexion est survenue.</h1>
      <p className="text-[color:var(--gris-600)]">
        Vos réponses n&apos;ont pas été perdues : elles sont conservées sur cet appareil.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="min-h-[56px] rounded-[var(--rayon-md)] bg-[color:var(--couleur-accent)] px-6 text-[length:var(--taille-md)] font-semibold text-[color:var(--couleur-accent-contraste)]"
      >
        Réessayer
      </button>
    </main>
  );
}
