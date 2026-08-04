import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, RoleUtilisateur, SourceInscription, StatutInscription, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { inscrireParticipant } from '../../src/lib/inscription';
import { SeminaireCompletError } from '../../src/lib/inscription-publique';
import {
  ajouterParticipantManuel,
  annulerInscriptionOrganisateur,
  listerInscriptionsSeminaire,
  refuserInscription,
  regenererJetonParticipant,
  validerInscription,
} from '../../src/lib/organisateur/participants';
import { genererCsvInscriptions } from '../../src/lib/organisateur/export-participants';

async function creerCabinet() {
  return prisma.cabinet.create({ data: { nom: `Cabinet participants ${Date.now()}-${Math.random()}` } });
}

async function creerSeminaire(
  cabinetId: string,
  overrides: Partial<{ capaciteMax: number | null; validationRequise: boolean }> = {},
) {
  return prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire participants test',
      dateDebut: new Date('2027-03-01T09:00:00Z'),
      dateFin: new Date('2027-03-01T17:00:00Z'),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.PUBLIE,
      capaciteMax: overrides.capaciteMax ?? null,
      validationRequise: overrides.validationRequise ?? false,
    },
  });
}

async function creerParticipant(cabinetId: string, suffixe: string) {
  return prisma.participant.create({
    data: { cabinetId, nom: 'Test', prenom: suffixe, email: `participant.${suffixe}.${Date.now()}.${Math.random()}@example.test` },
  });
}

describe('ajouterParticipantManuel', () => {
  it('crée un participant + inscription CONFIRMEE, source MANUEL', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id);

    const inscription = await ajouterParticipantManuel(cabinet.id, seminaire.id, {
      nom: 'Diop',
      prenom: 'Awa',
      email: `ajout.manuel.${Date.now()}@example.test`,
    });

    expect(inscription).not.toBeNull();
    expect(inscription!.statut).toBe(StatutInscription.CONFIRMEE);
    expect(inscription!.source).toBe(SourceInscription.MANUEL);
  });

  it('dédoublonne via trouverOuCreerParticipant (même email normalisé)', async () => {
    const cabinet = await creerCabinet();
    const seminaireA = await creerSeminaire(cabinet.id);
    const seminaireB = await creerSeminaire(cabinet.id);
    const email = `ibra.fall.${Date.now()}@x.sn`;

    await ajouterParticipantManuel(cabinet.id, seminaireA.id, { nom: 'Fall', prenom: 'Ibra', email: email.toUpperCase() });
    await ajouterParticipantManuel(cabinet.id, seminaireB.id, { nom: 'Fall', prenom: 'Ibra', email });

    const total = await prisma.participant.count({ where: { cabinetId: cabinet.id, email } });
    expect(total).toBe(1);
  });

  it('lève SeminaireCompletError si la capacité est atteinte, ignore validationRequise (toujours CONFIRMEE)', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, { capaciteMax: 1, validationRequise: true });

    const premiere = await ajouterParticipantManuel(cabinet.id, seminaire.id, {
      nom: 'A',
      prenom: '1',
      email: `a1.${Date.now()}@example.test`,
    });
    expect(premiere!.statut).toBe(StatutInscription.CONFIRMEE);

    await expect(
      ajouterParticipantManuel(cabinet.id, seminaire.id, { nom: 'B', prenom: '2', email: `b2.${Date.now()}@example.test` }),
    ).rejects.toThrow(SeminaireCompletError);
  });

  it("renvoie null pour un séminaire d'un autre cabinet", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const seminaire = await creerSeminaire(cabinetA.id);

    expect(
      await ajouterParticipantManuel(cabinetB.id, seminaire.id, { nom: 'X', prenom: 'Y', email: `xy.${Date.now()}@example.test` }),
    ).toBeNull();
  });
});

// Décision 9 : refuser/annuler doit libérer la place immédiatement — sans
// ce test, une régression réintroduisant un compteur mis en cache passerait
// inaperçue jusqu'à bloquer de vraies inscriptions sans raison visible.
describe('libération de place — refuser/annuler', () => {
  it('refuser une EN_ATTENTE sur un séminaire plein libère immédiatement la place', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, { capaciteMax: 1 });
    const participant = await creerParticipant(cabinet.id, 'attente');
    const inscriptionEnAttente = await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: participant.id,
      source: SourceInscription.AUTO_INSCRIPTION,
      statutCible: StatutInscription.EN_ATTENTE,
    });

    await expect(
      ajouterParticipantManuel(cabinet.id, seminaire.id, {
        nom: 'Nouveau',
        prenom: 'Venu',
        email: `nouveau.${Date.now()}@example.test`,
      }),
    ).rejects.toThrow(SeminaireCompletError);

    expect(await refuserInscription(cabinet.id, seminaire.id, inscriptionEnAttente.id)).toBe(true);

    const apresRefus = await ajouterParticipantManuel(cabinet.id, seminaire.id, {
      nom: 'Nouveau',
      prenom: 'Venu',
      email: `nouveau2.${Date.now()}@example.test`,
    });
    expect(apresRefus).not.toBeNull();
  });

  it('annuler une CONFIRMEE sur un séminaire plein libère immédiatement la place', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, { capaciteMax: 1 });
    const confirmee = await ajouterParticipantManuel(cabinet.id, seminaire.id, {
      nom: 'Confirme',
      prenom: 'A',
      email: `confirme.a.${Date.now()}@example.test`,
    });

    await expect(
      ajouterParticipantManuel(cabinet.id, seminaire.id, { nom: 'B', prenom: 'B', email: `b.b.${Date.now()}@example.test` }),
    ).rejects.toThrow(SeminaireCompletError);

    expect(await annulerInscriptionOrganisateur(cabinet.id, seminaire.id, confirmee!.id)).toBe(true);

    const apresAnnulation = await ajouterParticipantManuel(cabinet.id, seminaire.id, {
      nom: 'B',
      prenom: 'B',
      email: `b.b2.${Date.now()}@example.test`,
    });
    expect(apresAnnulation).not.toBeNull();
  });
});

describe('validerInscription / refuserInscription / annulerInscriptionOrganisateur', () => {
  it('valide une EN_ATTENTE -> CONFIRMEE', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id);
    const participant = await creerParticipant(cabinet.id, 'valide');
    const inscription = await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: participant.id,
      source: SourceInscription.AUTO_INSCRIPTION,
      statutCible: StatutInscription.EN_ATTENTE,
    });

    expect(await validerInscription(cabinet.id, seminaire.id, inscription.id)).toBe(true);
    const relue = await prisma.inscription.findUniqueOrThrow({ where: { id: inscription.id } });
    expect(relue.statut).toBe(StatutInscription.CONFIRMEE);
  });

  it('ne fait rien sur une inscription déjà CONFIRMEE (idempotent, renvoie false)', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id);
    const inscription = await ajouterParticipantManuel(cabinet.id, seminaire.id, {
      nom: 'X',
      prenom: 'Y',
      email: `idem.${Date.now()}@example.test`,
    });

    expect(await validerInscription(cabinet.id, seminaire.id, inscription!.id)).toBe(false);
  });

  it("renvoie false/null pour une inscription d'un autre cabinet, jamais une erreur distincte (règle B)", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const seminaire = await creerSeminaire(cabinetA.id);
    const participant = await creerParticipant(cabinetA.id, 'etranger');
    const inscription = await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: participant.id,
      source: SourceInscription.MANUEL,
      statutCible: StatutInscription.EN_ATTENTE,
    });

    expect(await validerInscription(cabinetB.id, seminaire.id, inscription.id)).toBe(false);
    expect(await refuserInscription(cabinetB.id, seminaire.id, inscription.id)).toBe(false);
    expect(await annulerInscriptionOrganisateur(cabinetB.id, seminaire.id, inscription.id)).toBe(false);
    expect(await regenererJetonParticipant(cabinetB.id, seminaire.id, inscription.id, 'inexistant')).toBeNull();
  });
});

describe('regenererJetonParticipant', () => {
  it('change le jeton et pose jetonRegenereLe/jetonRegenereParId', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id);
    const organisateur = await prisma.utilisateur.create({
      data: {
        cabinetId: cabinet.id,
        email: `orga.${Date.now()}.${Math.random()}@example.test`,
        nom: 'O',
        prenom: 'O',
        role: RoleUtilisateur.ORGANISATEUR,
        motDePasseHash: 'x',
      },
    });
    const inscription = await ajouterParticipantManuel(cabinet.id, seminaire.id, {
      nom: 'J',
      prenom: 'K',
      email: `jeton.${Date.now()}@example.test`,
    });

    const nouveauJeton = await regenererJetonParticipant(cabinet.id, seminaire.id, inscription!.id, organisateur.id);
    expect(nouveauJeton).toBeTruthy();
    expect(nouveauJeton).not.toBe(inscription!.jeton);

    const relue = await prisma.inscription.findUniqueOrThrow({ where: { id: inscription!.id } });
    expect(relue.jeton).toBe(nouveauJeton);
    expect(relue.jetonRegenereLe).not.toBeNull();
    expect(relue.jetonRegenereParId).toBe(organisateur.id);
  });
});

describe('listerInscriptionsSeminaire', () => {
  it('trie EN_ATTENTE en premier puis par ordre alphabétique, filtre par statut', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id);

    const zed = await creerParticipant(cabinet.id, 'zed');
    const alice = await creerParticipant(cabinet.id, 'alice');
    await prisma.participant.update({ where: { id: zed.id }, data: { nom: 'Zed' } });
    await prisma.participant.update({ where: { id: alice.id }, data: { nom: 'Alice' } });

    await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: zed.id,
      source: SourceInscription.MANUEL,
      statutCible: StatutInscription.CONFIRMEE,
    });
    const enAttente = await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: alice.id,
      source: SourceInscription.AUTO_INSCRIPTION,
      statutCible: StatutInscription.EN_ATTENTE,
    });

    const liste = await listerInscriptionsSeminaire(cabinet.id, seminaire.id);
    expect(liste).not.toBeNull();
    expect(liste!.map((i) => i.participant.nom)).toEqual(['Alice', 'Zed']);

    const filtre = await listerInscriptionsSeminaire(cabinet.id, seminaire.id, StatutInscription.EN_ATTENTE);
    expect(filtre!.map((i) => i.id)).toEqual([enAttente.id]);
  });

  it("renvoie null pour un séminaire d'un autre cabinet", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const seminaire = await creerSeminaire(cabinetA.id);

    expect(await listerInscriptionsSeminaire(cabinetB.id, seminaire.id)).toBeNull();
  });
});

// Décision 7 : la colonne « a répondu » reste en oui/non strict, jamais la
// date, et jamais dans l'export CSV.
describe("confidentialité — aReponduLe n'est jamais exposé", () => {
  it('listerInscriptionsSeminaire ne renvoie pas la clé aReponduLe ; le CSV exclut jeton et « a répondu »', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id);
    const participant = await creerParticipant(cabinet.id, 'reponse');
    const inscription = await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: participant.id,
      source: SourceInscription.MANUEL,
      statutCible: StatutInscription.CONFIRMEE,
    });

    await prisma.inscription.update({
      where: { id: inscription.id },
      data: { aRepondu: true, aReponduLe: new Date('2027-03-15') },
    });

    const liste = await listerInscriptionsSeminaire(cabinet.id, seminaire.id);
    const ligne = liste!.find((i) => i.id === inscription.id)!;
    expect(ligne.aRepondu).toBe(true);
    expect(Object.keys(ligne)).not.toContain('aReponduLe');

    const csv = await genererCsvInscriptions(cabinet.id, seminaire.id);
    expect(csv).not.toBeNull();
    expect(csv).not.toContain('2027-03-15');
    expect(csv).not.toContain('15/03/2027');
    expect(csv!.toLowerCase()).not.toContain('jeton');
    expect(csv!.toLowerCase()).not.toContain('répondu');
    expect(csv).not.toContain(inscription.jeton);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
