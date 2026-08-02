import 'server-only';
import type { FinaliteConsentement } from '@prisma/client';

/**
 * Textes de consentement versionnés dans le dépôt. Changer un texte impose
 * une nouvelle clé de version — les anciennes ne sont JAMAIS supprimées :
 * elles restent la référence exacte de ce à quoi chaque ligne historique de
 * `consentement` correspond (`versionTexte`).
 */
export const CONSENTEMENT_VERSION_ACTUELLE = 'v1.0-2026-07';

interface TexteFinalite {
  texte: string;
  dureeConservation: string;
}

/**
 * `dureeConservation` est une mention juridique : elle ne s'invente pas dans
 * le code. Chaque cabinet doit la renseigner explicitement avant mise en
 * production — `texteConsentement()` lève une exception si elle est absente
 * plutôt que d'afficher une durée plausible mais fabriquée.
 *
 * Un texte de test temporaire (ex. pour débloquer un rendu en local) doit
 * contenir le marqueur `MARQUEUR_PLACEHOLDER` ci-dessous : c'est ce qui
 * permet à `validerTextesConsentementProduction()` de le distinguer d'une
 * vraie mention juridique et de refuser le démarrage en production tant
 * qu'il n'a pas été remplacé.
 */
const MARQUEUR_PLACEHOLDER = 'QA TEMPORAIRE';

export const TEXTES_CONSENTEMENT: Record<string, Record<FinaliteConsentement, TexteFinalite>> = {
  'v1.0-2026-07': {
    INSCRIPTION_EVALUATION: {
      texte:
        "Vos coordonnées sont utilisées pour gérer votre inscription, vous donner accès aux supports de ce séminaire et vous permettre de l'évaluer.",
      dureeConservation: '',
    },
    COMMUNICATIONS: {
      texte: 'Je souhaite recevoir des informations sur les prochaines formations de ce cabinet.',
      dureeConservation: '',
    },
    PARTAGE_EMPLOYEUR: {
      texte:
        "J'autorise la transmission de ma présence et de mon attestation à l'employeur qui finance cette formation.",
      dureeConservation: '',
    },
  },
};

/**
 * Appelée une seule fois au démarrage du serveur (voir `instrumentation.ts`).
 * En production, un texte de conservation vide ou marqué placeholder ne doit
 * jamais atteindre un participant réel : mieux vaut que l'application refuse
 * de démarrer qu'afficher une mention juridique factice.
 *
 * `textes`/`version` ne sont paramétrables que pour les tests — les appels
 * réels utilisent toujours les valeurs par défaut.
 */
export function validerTextesConsentementProduction(
  textes: Record<string, Record<FinaliteConsentement, TexteFinalite>> = TEXTES_CONSENTEMENT,
  version: string = CONSENTEMENT_VERSION_ACTUELLE,
): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const textesVersionActuelle = textes[version];
  if (!textesVersionActuelle) {
    throw new Error(`Aucun texte de consentement pour la version actuelle (${version}).`);
  }
  for (const [finalite, entree] of Object.entries(textesVersionActuelle)) {
    const duree = entree.dureeConservation;
    if (!duree.trim() || duree.includes(MARQUEUR_PLACEHOLDER)) {
      throw new Error(
        `dureeConservation manquante ou factice pour ${finalite} (version ${version}) : ` +
          'mention juridique réelle à obtenir du cabinet avant toute mise en ligne — ' +
          "refus de démarrage plutôt qu'affichage d'un texte non valide à un participant.",
      );
    }
  }
}

export function texteConsentement(finalite: FinaliteConsentement): TexteFinalite {
  const entree = TEXTES_CONSENTEMENT[CONSENTEMENT_VERSION_ACTUELLE]?.[finalite];
  if (!entree) {
    throw new Error(`Texte de consentement manquant pour ${finalite} (version ${CONSENTEMENT_VERSION_ACTUELLE}).`);
  }
  if (!entree.dureeConservation.trim()) {
    throw new Error(
      `dureeConservation manquante pour ${finalite} : mention juridique à renseigner par le cabinet ` +
        'avant mise en production — ne jamais la remplacer par une valeur inventée.',
    );
  }
  return entree;
}
