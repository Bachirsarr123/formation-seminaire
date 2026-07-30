import 'server-only';
import { estConsentementActif } from './consentement';

interface Destinataire {
  participantId: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
}

export interface NotificationAdapter {
  envoyer(params: { destinataire: Destinataire; sujet: string; corps: string }): Promise<void>;
}

// Seul adaptateur pour ce lot : aucun fournisseur d'email/SMS n'est intégré
// avant que le parcours soit stabilisé.
const adaptateurConsole: NotificationAdapter = {
  async envoyer({ destinataire, sujet, corps }) {
    console.log(`[notification] ${destinataire.prenom} ${destinataire.nom} — ${sujet}\n${corps}`);
  },
};

let adaptateurActif: NotificationAdapter = adaptateurConsole;

export function definirAdaptateurNotification(adaptateur: NotificationAdapter): void {
  adaptateurActif = adaptateur;
}

// ============================================================
// Transactionnel — découle de l'inscription elle-même, jamais bloqué par un
// retrait de consentement (COMMUNICATIONS ou autre) : ce ne sont pas des
// messages de prospection mais l'exécution du service demandé.
// ============================================================

export async function envoyerLienInscription(destinataire: Destinataire, lien: string): Promise<void> {
  await adaptateurActif.envoyer({
    destinataire,
    sujet: 'Votre accès personnel',
    corps: `Voici votre lien personnel, à conserver précieusement : ${lien}`,
  });
}

export async function envoyerRappelSeminaire(destinataire: Destinataire, titreSeminaire: string): Promise<void> {
  await adaptateurActif.envoyer({
    destinataire,
    sujet: `Rappel — ${titreSeminaire}`,
    corps: `Votre séminaire « ${titreSeminaire} » a lieu demain.`,
  });
}

export async function envoyerRelanceQuestionnaire(destinataire: Destinataire, titreSeminaire: string): Promise<void> {
  await adaptateurActif.envoyer({
    destinataire,
    sujet: `Votre avis compte — ${titreSeminaire}`,
    corps: `Il ne vous reste que quelques minutes pour évaluer « ${titreSeminaire} ».`,
  });
}

export async function envoyerAttestation(destinataire: Destinataire, titreSeminaire: string): Promise<void> {
  await adaptateurActif.envoyer({
    destinataire,
    sujet: `Votre attestation — ${titreSeminaire}`,
    corps: `Votre attestation de présence pour « ${titreSeminaire} » est disponible.`,
  });
}

// ============================================================
// Prospection — seule famille gardée par estConsentementActif. Le verrou
// vit ICI, dans la fonction exportée elle-même, pas chez l'appelant ni dans
// l'adaptateur : impossible à contourner en changeant d'adaptateur plus tard.
// ============================================================

export async function envoyerInformationFormations(
  destinataire: Destinataire,
  corps: string,
): Promise<{ envoye: boolean }> {
  const autorise = await estConsentementActif(destinataire.participantId, 'COMMUNICATIONS');
  if (!autorise) return { envoye: false };

  await adaptateurActif.envoyer({ destinataire, sujet: 'Nos prochaines formations', corps });
  return { envoye: true };
}
