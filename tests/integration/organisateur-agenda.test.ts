import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, SourceInscription, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  genererFluxIcsCabinet,
  listerSeminairesAgenda,
  obtenirOuGenererJetonFluxIcs,
  regenererJetonFluxIcs,
  resoudreCabinetParJetonFluxIcs,
} from '../../src/lib/organisateur/agenda';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { inscrireParticipant } from '../../src/lib/inscription';

async function creerCabinetEtSeminaire(dateDebut: Date, dateFin: Date) {
  const cabinet = await prisma.cabinet.create({ data: { nom: `Cabinet agenda-test ${Date.now()}-${Math.random()}` } });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire agenda',
      dateDebut,
      dateFin,
      lieu: 'Dakar',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.PUBLIE,
    },
  });
  return { cabinet, seminaire };
}

describe("genererFluxIcsCabinet — minimisation des données (lot 4, point de vigilance)", () => {
  it('ne contient jamais le codePublic ni aucune donnée participant', async () => {
    const { cabinet, seminaire } = await creerCabinetEtSeminaire(
      new Date('2026-10-10T09:00:00Z'),
      new Date('2026-10-10T17:00:00Z'),
    );
    const participant = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: 'NomSecretParticipant', prenom: 'PrenomSecret', email: 'secret@example.test' },
    });
    await inscrireParticipant({ seminaireId: seminaire.id, participantId: participant.id, source: SourceInscription.MANUEL });

    const ics = await genererFluxIcsCabinet(cabinet.id);

    expect(ics).toContain('Séminaire agenda');
    expect(ics).toContain('Dakar');
    expect(ics).not.toContain(seminaire.codePublic);
    expect(ics).not.toContain('NomSecretParticipant');
    expect(ics).not.toContain('PrenomSecret');
    expect(ics).not.toContain('secret@example.test');
  });

  it('exclut les séminaires BROUILLON et ARCHIVE', async () => {
    const { cabinet } = await creerCabinetEtSeminaire(new Date('2026-10-11T09:00:00Z'), new Date('2026-10-11T17:00:00Z'));
    const brouillon = await prisma.seminaire.create({
      data: {
        cabinetId: cabinet.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Titre brouillon jamais publié',
        dateDebut: new Date('2026-10-12T09:00:00Z'),
        dateFin: new Date('2026-10-12T17:00:00Z'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 7,
        statut: StatutSeminaire.BROUILLON,
      },
    });

    const ics = await genererFluxIcsCabinet(cabinet.id);
    expect(ics).not.toContain(brouillon.titre);
  });
});

describe('Jeton de flux ICS — obtention, régénération, révocation', () => {
  it('génère une fois puis renvoie toujours le même jeton (idempotent)', async () => {
    const cabinet = await prisma.cabinet.create({ data: { nom: `Cabinet jeton-idem ${Date.now()}` } });
    const premier = await obtenirOuGenererJetonFluxIcs(cabinet.id);
    const second = await obtenirOuGenererJetonFluxIcs(cabinet.id);
    expect(premier).toBe(second);
  });

  it("la régénération invalide l'ancien jeton immédiatement", async () => {
    const cabinet = await prisma.cabinet.create({ data: { nom: `Cabinet jeton-revoc ${Date.now()}` } });
    const ancien = await obtenirOuGenererJetonFluxIcs(cabinet.id);
    const nouveau = await regenererJetonFluxIcs(cabinet.id);

    expect(nouveau).not.toBe(ancien);
    expect(await resoudreCabinetParJetonFluxIcs(ancien)).toBeNull();
    expect(await resoudreCabinetParJetonFluxIcs(nouveau)).toEqual({ cabinetId: cabinet.id });
  });
});

describe('listerSeminairesAgenda — bornage par mois', () => {
  it("inclut un séminaire entièrement dans le mois, exclut un séminaire d'un autre mois, inclut un séminaire chevauchant la frontière", async () => {
    const cabinet = await prisma.cabinet.create({ data: { nom: `Cabinet agenda-bornage ${Date.now()}` } });

    const dansLeMois = await prisma.seminaire.create({
      data: {
        cabinetId: cabinet.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Dans le mois',
        dateDebut: new Date('2026-11-15T09:00:00Z'),
        dateFin: new Date('2026-11-15T17:00:00Z'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 7,
        statut: StatutSeminaire.PUBLIE,
      },
    });
    const moisSuivant = await prisma.seminaire.create({
      data: {
        cabinetId: cabinet.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Mois suivant',
        dateDebut: new Date('2026-12-05T09:00:00Z'),
        dateFin: new Date('2026-12-05T17:00:00Z'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 7,
        statut: StatutSeminaire.PUBLIE,
      },
    });
    const chevauchant = await prisma.seminaire.create({
      data: {
        cabinetId: cabinet.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Chevauche la fin du mois',
        dateDebut: new Date('2026-11-30T09:00:00Z'),
        dateFin: new Date('2026-12-01T17:00:00Z'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 14,
        statut: StatutSeminaire.PUBLIE,
      },
    });

    const resultat = await listerSeminairesAgenda(cabinet.id, { annee: 2026, mois: 11 });
    const ids = resultat.map((s) => s.id);

    expect(ids).toContain(dansLeMois.id);
    expect(ids).toContain(chevauchant.id);
    expect(ids).not.toContain(moisSuivant.id);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
