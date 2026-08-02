/**
 * Next.js appelle `register()` une seule fois au démarrage du serveur, avant
 * de traiter la moindre requête. On l'utilise pour vérifier que les mentions
 * juridiques de consentement sont réellement renseignées en production —
 * voir `validerTextesConsentementProduction()`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validerTextesConsentementProduction } = await import('@/lib/consentement/textes');
    validerTextesConsentementProduction();
  }
}
