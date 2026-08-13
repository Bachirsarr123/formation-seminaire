import { describe, expect, it } from 'vitest';
import { definirAdaptateurNotification, envoyerRelanceQuestionnaire, type NotificationAdapter } from '../../src/lib/notification';

const destinataire = {
  participantId: 'peu-importe',
  nom: 'Ndour',
  prenom: 'Fatou',
  email: 'fatou.ndour@example.test',
  telephone: null,
};

describe('envoyerRelanceQuestionnaire', () => {
  it("inclut le lien personnel dans le corps du message — sans lui, la relance ne donne aucun moyen de répondre", async () => {
    const appels: Array<{ sujet: string; corps: string }> = [];
    const adaptateurEspion: NotificationAdapter = {
      async envoyer({ sujet, corps }) {
        appels.push({ sujet, corps });
      },
    };
    definirAdaptateurNotification(adaptateurEspion);

    const lien = 'https://exemple.test/p/un-jeton-de-test';
    await envoyerRelanceQuestionnaire(destinataire, 'Séminaire test relance', lien);

    expect(appels).toHaveLength(1);
    expect(appels[0]!.corps).toContain(lien);
  });
});
