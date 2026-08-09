import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  consulterReponseMessageAnonyme,
  envoyerMessageAnonyme,
  marquerMessageLu,
  marquerMessageTraite,
  MessageAnonymeInvalideError,
  repondreMessageAnonyme,
} from '../../src/lib/anonymat';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { hacherJeton } from '../../src/lib/organisateur/jeton-hash';

async function creerCabinetEtSeminaire() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test anonymat 2' } });

  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire anonymat 2',
      dateDebut: new Date('2026-11-01'),
      dateFin: new Date('2026-11-01'),
      modalite: Modalite.HYBRIDE,
      dureeHeures: 4,
      statut: StatutSeminaire.PUBLIE,
      seuilAnonymat: 5,
    },
  });

  return { cabinet, seminaire };
}

describe('envoyerMessageAnonyme', () => {
  it('crée le message et retourne un code en clair jamais stocké tel quel', async () => {
    const { seminaire } = await creerCabinetEtSeminaire();

    const code = await envoyerMessageAnonyme(seminaire.id, '  Un message avec espaces autour.  ');

    const message = await prisma.messageAnonyme.findFirst({ where: { seminaireId: seminaire.id } });
    expect(message).not.toBeNull();
    expect(message!.contenu).toBe('Un message avec espaces autour.');
    expect(message!.codeSuiviHash).toBe(hacherJeton(code));
    expect(message!.codeSuiviHash).not.toBe(code);
    expect(message!.statut).toBe('NOUVEAU');
  });

  it('refuse un message vide', async () => {
    const { seminaire } = await creerCabinetEtSeminaire();
    await expect(envoyerMessageAnonyme(seminaire.id, '   ')).rejects.toThrow(MessageAnonymeInvalideError);
  });

  it('refuse un message de plus de 2000 caractères', async () => {
    const { seminaire } = await creerCabinetEtSeminaire();
    await expect(envoyerMessageAnonyme(seminaire.id, 'a'.repeat(2001))).rejects.toThrow(MessageAnonymeInvalideError);
  });
});

describe('consulterReponseMessageAnonyme', () => {
  it('retrouve un message par son code de suivi', async () => {
    const { seminaire } = await creerCabinetEtSeminaire();
    const code = await envoyerMessageAnonyme(seminaire.id, 'Message à retrouver.');

    const reponse = await consulterReponseMessageAnonyme(seminaire.id, code);

    expect(reponse).not.toBeNull();
    expect(reponse!.contenu).toBe('Message à retrouver.');
    expect(reponse!.statut).toBe('NOUVEAU');
    expect(reponse!.reponseOrganisateur).toBeNull();
  });

  it('ignore les espaces ajoutés par la saisie', async () => {
    const { seminaire } = await creerCabinetEtSeminaire();
    const code = await envoyerMessageAnonyme(seminaire.id, 'Message avec code retranscrit.');
    const codeAvecEspaces = `${code.slice(0, 4)}  ${code.slice(4)} `;

    const reponse = await consulterReponseMessageAnonyme(seminaire.id, codeAvecEspaces);

    expect(reponse).not.toBeNull();
  });

  it("retourne null pour un code inconnu", async () => {
    const { seminaire } = await creerCabinetEtSeminaire();
    expect(await consulterReponseMessageAnonyme(seminaire.id, 'code-inexistant')).toBeNull();
  });

  it("retourne null pour un code appartenant à un autre séminaire", async () => {
    const { seminaire: seminaireA } = await creerCabinetEtSeminaire();
    const { seminaire: seminaireB } = await creerCabinetEtSeminaire();
    const code = await envoyerMessageAnonyme(seminaireA.id, 'Message du séminaire A.');

    expect(await consulterReponseMessageAnonyme(seminaireB.id, code)).toBeNull();
  });
});

describe('repondreMessageAnonyme', () => {
  it('enregistre la réponse et marque le message TRAITE', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    const code = await envoyerMessageAnonyme(seminaire.id, 'Question au formateur.');
    const message = await prisma.messageAnonyme.findFirstOrThrow({
      where: { codeSuiviHash: hacherJeton(code) },
    });

    const ok = await repondreMessageAnonyme(cabinet.id, seminaire.id, message.id, '  Voici la réponse.  ');
    expect(ok).toBe(true);

    const relu = await prisma.messageAnonyme.findUniqueOrThrow({ where: { id: message.id } });
    expect(relu.reponseOrganisateur).toBe('Voici la réponse.');
    expect(relu.statut).toBe('TRAITE');
    expect(relu.dateReponse).not.toBeNull();
  });

  it("refuse pour un cabinet qui n'est pas propriétaire du séminaire (règle B)", async () => {
    const { seminaire } = await creerCabinetEtSeminaire();
    const { cabinet: autreCabinet } = await creerCabinetEtSeminaire();
    const code = await envoyerMessageAnonyme(seminaire.id, 'Message isolé.');
    const message = await prisma.messageAnonyme.findFirstOrThrow({
      where: { codeSuiviHash: hacherJeton(code) },
    });

    const ok = await repondreMessageAnonyme(autreCabinet.id, seminaire.id, message.id, 'Réponse usurpée.');
    expect(ok).toBe(false);

    const relu = await prisma.messageAnonyme.findUniqueOrThrow({ where: { id: message.id } });
    expect(relu.reponseOrganisateur).toBeNull();
    expect(relu.statut).toBe('NOUVEAU');
  });

  it('refuse une réponse vide', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    const code = await envoyerMessageAnonyme(seminaire.id, 'Message.');
    const message = await prisma.messageAnonyme.findFirstOrThrow({
      where: { codeSuiviHash: hacherJeton(code) },
    });

    expect(await repondreMessageAnonyme(cabinet.id, seminaire.id, message.id, '   ')).toBe(false);
  });
});

describe('marquerMessageLu / marquerMessageTraite', () => {
  it('marquerMessageLu passe le statut à LU sans toucher la réponse', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    const code = await envoyerMessageAnonyme(seminaire.id, 'Message à lire.');
    const message = await prisma.messageAnonyme.findFirstOrThrow({
      where: { codeSuiviHash: hacherJeton(code) },
    });

    expect(await marquerMessageLu(cabinet.id, seminaire.id, message.id)).toBe(true);

    const relu = await prisma.messageAnonyme.findUniqueOrThrow({ where: { id: message.id } });
    expect(relu.statut).toBe('LU');
    expect(relu.reponseOrganisateur).toBeNull();
  });

  it('marquerMessageTraite passe le statut à TRAITE sans réponse écrite', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire();
    const code = await envoyerMessageAnonyme(seminaire.id, 'Résolu de vive voix.');
    const message = await prisma.messageAnonyme.findFirstOrThrow({
      where: { codeSuiviHash: hacherJeton(code) },
    });

    expect(await marquerMessageTraite(cabinet.id, seminaire.id, message.id)).toBe(true);

    const relu = await prisma.messageAnonyme.findUniqueOrThrow({ where: { id: message.id } });
    expect(relu.statut).toBe('TRAITE');
    expect(relu.reponseOrganisateur).toBeNull();
  });

  it("les deux refusent pour un cabinet étranger", async () => {
    const { seminaire } = await creerCabinetEtSeminaire();
    const { cabinet: autreCabinet } = await creerCabinetEtSeminaire();
    const code = await envoyerMessageAnonyme(seminaire.id, 'Message protégé.');
    const message = await prisma.messageAnonyme.findFirstOrThrow({
      where: { codeSuiviHash: hacherJeton(code) },
    });

    expect(await marquerMessageLu(autreCabinet.id, seminaire.id, message.id)).toBe(false);
    expect(await marquerMessageTraite(autreCabinet.id, seminaire.id, message.id)).toBe(false);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
