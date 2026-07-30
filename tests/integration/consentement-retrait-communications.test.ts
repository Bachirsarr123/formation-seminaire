import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { traiterInscriptionPublique } from '../../src/lib/inscription-publique';
import {
  ConsentementNonRetirableError,
  estConsentementActif,
  retirerConsentement,
} from '../../src/lib/consentement';
import {
  definirAdaptateurNotification,
  envoyerInformationFormations,
  envoyerRappelSeminaire,
  type NotificationAdapter,
} from '../../src/lib/notification';

async function inscrireAvecCommunications() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test retrait communications' } });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire test retrait communications',
      dateDebut: new Date('2027-03-01'),
      dateFin: new Date('2027-03-01'),
      modalite: Modalite.DISTANCIEL,
      dureeHeures: 3,
      statut: StatutSeminaire.PUBLIE,
      inscriptionOuverte: true,
    },
  });

  const resultat = await traiterInscriptionPublique({
    seminaireId: seminaire.id,
    nom: 'Ndour',
    prenom: 'Fatou',
    email: 'fatou.ndour.communications@example.test',
    telephone: null,
    fonction: null,
    organisation: null,
    ip: '203.0.113.30',
    userAgent: 'vitest',
    communicationsCoche: true,
    partageEmployeurCoche: false,
  });

  const inscription = await prisma.inscription.findUniqueOrThrow({ where: { jeton: resultat.jeton } });
  return { inscription, participantId: inscription.participantId };
}

const appelsAdaptateur: Array<{ sujet: string }> = [];
const adaptateurEspion: NotificationAdapter = {
  async envoyer({ sujet }) {
    appelsAdaptateur.push({ sujet });
  },
};

const destinataireFactice = {
  participantId: '',
  nom: 'Ndour',
  prenom: 'Fatou',
  email: 'fatou.ndour.communications@example.test',
  telephone: null,
};

describe('Retrait du consentement COMMUNICATIONS — effet réel', () => {
  beforeEach(() => {
    appelsAdaptateur.length = 0;
    definirAdaptateurNotification(adaptateurEspion);
  });

  it('coupe envoyerInformationFormations mais jamais envoyerRappelSeminaire (transactionnel)', async () => {
    const { inscription, participantId } = await inscrireAvecCommunications();
    const destinataire = { ...destinataireFactice, participantId };

    expect(await estConsentementActif(participantId, 'COMMUNICATIONS')).toBe(true);
    expect((await envoyerInformationFormations(destinataire, 'Catalogue 2027')).envoye).toBe(true);
    expect(appelsAdaptateur).toHaveLength(1);

    await retirerConsentement(participantId, 'COMMUNICATIONS');
    expect(await estConsentementActif(participantId, 'COMMUNICATIONS')).toBe(false);

    const resultatApresRetrait = await envoyerInformationFormations(destinataire, 'Catalogue 2027');
    expect(resultatApresRetrait.envoye).toBe(false);
    expect(appelsAdaptateur).toHaveLength(1); // pas d'appel supplémentaire à l'adaptateur

    // Transactionnel : jamais bloqué par le retrait de COMMUNICATIONS.
    await envoyerRappelSeminaire(destinataire, 'Séminaire test retrait communications');
    expect(appelsAdaptateur).toHaveLength(2);

    // Idempotent : un second retrait ne relance rien, ne plante pas.
    await expect(retirerConsentement(participantId, 'COMMUNICATIONS')).resolves.toBeNull();

    // L'inscription elle-même n'est pas affectée par le retrait.
    const inscriptionApres = await prisma.inscription.findUniqueOrThrow({ where: { id: inscription.id } });
    expect(inscriptionApres.statut).toBe(inscription.statut);
    expect(inscriptionApres.aRepondu).toBe(inscription.aRepondu);
    expect(inscriptionApres.aReponduLe).toEqual(inscription.aReponduLe);
  });

  it('INSCRIPTION_EVALUATION ne peut pas être retiré via le lib non plus', async () => {
    const { participantId } = await inscrireAvecCommunications();

    await expect(retirerConsentement(participantId, 'INSCRIPTION_EVALUATION')).rejects.toBeInstanceOf(
      ConsentementNonRetirableError,
    );
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
