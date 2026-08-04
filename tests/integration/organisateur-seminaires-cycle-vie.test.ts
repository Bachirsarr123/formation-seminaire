import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, RoleUtilisateur, SourceInscription, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  CapaciteInferieureAuxInscritsError,
  FormateurEtrangerError,
  TransitionStatutInvalideError,
  changerStatutSeminaire,
  creerSeminaire,
  dupliquerSeminaire,
  modifierSeminaire,
  obtenirSeminaire,
  supprimerSeminaireLogiquement,
  type DonneesSeminaire,
} from '../../src/lib/organisateur/seminaires';
import { inscrireParticipant } from '../../src/lib/inscription';

function donneesDeBase(overrides: Partial<DonneesSeminaire> = {}): DonneesSeminaire {
  return {
    titre: 'Séminaire de test',
    description: 'Description',
    dateDebut: new Date('2026-09-01T09:00:00Z'),
    dateFin: new Date('2026-09-01T17:00:00Z'),
    lieu: 'Dakar',
    modalite: Modalite.PRESENTIEL,
    dureeHeures: 7,
    capaciteMax: 30,
    inscriptionOuverte: false,
    validationRequise: false,
    seuilAnonymat: 5,
    formateurs: [],
    modules: [{ titre: 'Introduction', dureeMinutes: 60, ordre: 1 }],
    ...overrides,
  };
}

async function creerCabinet() {
  return prisma.cabinet.create({ data: { nom: `Cabinet cycle-vie ${Date.now()}-${Math.random()}` } });
}

async function creerFormateur(cabinetId: string) {
  return prisma.utilisateur.create({
    data: {
      cabinetId,
      email: `formateur.${Date.now()}.${Math.random()}@example.test`,
      nom: 'Test',
      prenom: 'Formateur',
      role: RoleUtilisateur.FORMATEUR,
      motDePasseHash: null,
    },
  });
}

describe('creerSeminaire', () => {
  it('crée en BROUILLON, génère un codePublic, crée modules et formateurs', async () => {
    const cabinet = await creerCabinet();
    const formateur = await creerFormateur(cabinet.id);

    const seminaire = await creerSeminaire(
      cabinet.id,
      donneesDeBase({ formateurs: [{ utilisateurId: formateur.id, roleFormateur: 'PRINCIPAL' }] }),
    );

    expect(seminaire.statut).toBe(StatutSeminaire.BROUILLON);
    expect(seminaire.codePublic).toBeTruthy();

    const complet = await obtenirSeminaire(cabinet.id, seminaire.id);
    expect(complet!.modules).toHaveLength(1);
    expect(complet!.formateurs).toHaveLength(1);
    expect(complet!.formateurs[0]!.utilisateurId).toBe(formateur.id);
  });

  it("refuse un formateur qui n'appartient pas au cabinet", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const formateurDeB = await creerFormateur(cabinetB.id);

    await expect(
      creerSeminaire(cabinetA.id, donneesDeBase({ formateurs: [{ utilisateurId: formateurDeB.id, roleFormateur: 'INTERVENANT' }] })),
    ).rejects.toThrow(FormateurEtrangerError);
  });
});

describe('obtenirSeminaire — isolation', () => {
  it("renvoie null pour un séminaire d'un autre cabinet (jamais l'objet)", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const seminaire = await creerSeminaire(cabinetA.id, donneesDeBase());

    expect(await obtenirSeminaire(cabinetB.id, seminaire.id)).toBeNull();
    expect(await obtenirSeminaire(cabinetA.id, seminaire.id)).not.toBeNull();
  });
});

describe('modifierSeminaire', () => {
  it('met à jour les champs et remplace modules/formateurs', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, donneesDeBase());

    const modifie = await modifierSeminaire(
      cabinet.id,
      seminaire.id,
      donneesDeBase({ titre: 'Titre modifié', modules: [{ titre: 'Nouveau module', dureeMinutes: 90, ordre: 1 }] }),
    );

    expect(modifie!.titre).toBe('Titre modifié');
    const complet = await obtenirSeminaire(cabinet.id, seminaire.id);
    expect(complet!.modules).toHaveLength(1);
    expect(complet!.modules[0]!.titre).toBe('Nouveau module');
  });

  it('refuse de réduire la capacité sous le nombre d\'inscrits', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, donneesDeBase({ capaciteMax: 10 }));
    for (let i = 0; i < 3; i++) {
      const participant = await prisma.participant.create({
        data: { cabinetId: cabinet.id, nom: 'P', prenom: `${i}`, email: `capacite.${i}.${Date.now()}@example.test` },
      });
      // eslint-disable-next-line no-await-in-loop
      await inscrireParticipant({ seminaireId: seminaire.id, participantId: participant.id, source: SourceInscription.MANUEL });
    }

    await expect(modifierSeminaire(cabinet.id, seminaire.id, donneesDeBase({ capaciteMax: 2 }))).rejects.toThrow(
      CapaciteInferieureAuxInscritsError,
    );

    // Une capacité suffisante passe normalement.
    await expect(modifierSeminaire(cabinet.id, seminaire.id, donneesDeBase({ capaciteMax: 3 }))).resolves.toBeTruthy();
  });

  it("renvoie null pour un séminaire d'un autre cabinet, sans rien modifier", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const seminaire = await creerSeminaire(cabinetA.id, donneesDeBase());

    const resultat = await modifierSeminaire(cabinetB.id, seminaire.id, donneesDeBase({ titre: 'Piraté' }));
    expect(resultat).toBeNull();

    const relu = await obtenirSeminaire(cabinetA.id, seminaire.id);
    expect(relu!.titre).not.toBe('Piraté');
  });
});

describe('changerStatutSeminaire — cycle de vie', () => {
  it('BROUILLON -> PUBLIE -> BROUILLON reste autorisé (pas encore EN_COURS)', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, donneesDeBase());

    const publie = await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.PUBLIE);
    expect(publie!.statut).toBe(StatutSeminaire.PUBLIE);

    const rebrouillon = await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.BROUILLON);
    expect(rebrouillon!.statut).toBe(StatutSeminaire.BROUILLON);
  });

  it('EN_COURS -> PUBLIE est refusé (transition arrière interdite au-delà de EN_COURS)', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, donneesDeBase());
    await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.PUBLIE);
    await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.EN_COURS);

    await expect(changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.PUBLIE)).rejects.toThrow(
      TransitionStatutInvalideError,
    );
  });

  it('CLOTURE -> EN_COURS est refusé', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, donneesDeBase());
    await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.PUBLIE);
    await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.EN_COURS);
    await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.CLOTURE);

    await expect(changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.EN_COURS)).rejects.toThrow(
      TransitionStatutInvalideError,
    );
  });

  it('EN_COURS -> CLOTURE -> ARCHIVE (avant, toujours autorisé)', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, donneesDeBase());
    await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.PUBLIE);
    await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.EN_COURS);
    const cloture = await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.CLOTURE);
    expect(cloture!.statut).toBe(StatutSeminaire.CLOTURE);
    const archive = await changerStatutSeminaire(cabinet.id, seminaire.id, StatutSeminaire.ARCHIVE);
    expect(archive!.statut).toBe(StatutSeminaire.ARCHIVE);
  });
});

describe('supprimerSeminaireLogiquement', () => {
  it('pose supprimeLe, jamais de suppression physique — obtenirSeminaire ne le retrouve plus', async () => {
    const cabinet = await creerCabinet();
    const seminaire = await creerSeminaire(cabinet.id, donneesDeBase());

    const succes = await supprimerSeminaireLogiquement(cabinet.id, seminaire.id);
    expect(succes).toBe(true);

    expect(await obtenirSeminaire(cabinet.id, seminaire.id)).toBeNull();
    const enBase = await prisma.seminaire.findUniqueOrThrow({ where: { id: seminaire.id } });
    expect(enBase.supprimeLe).not.toBeNull();
  });

  it("renvoie false pour un séminaire d'un autre cabinet, sans le supprimer", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const seminaire = await creerSeminaire(cabinetA.id, donneesDeBase());

    expect(await supprimerSeminaireLogiquement(cabinetB.id, seminaire.id)).toBe(false);
    expect(await obtenirSeminaire(cabinetA.id, seminaire.id)).not.toBeNull();
  });
});

describe('dupliquerSeminaire', () => {
  it('copie modules et formateurs, jamais les participants, avec un codePublic neuf et le statut BROUILLON', async () => {
    const cabinet = await creerCabinet();
    const formateur = await creerFormateur(cabinet.id);
    const original = await creerSeminaire(
      cabinet.id,
      donneesDeBase({
        modules: [{ titre: 'Module A', dureeMinutes: 45, ordre: 1 }, { titre: 'Module B', dureeMinutes: 30, ordre: 2 }],
        formateurs: [{ utilisateurId: formateur.id, roleFormateur: 'PRINCIPAL' }],
      }),
    );
    await changerStatutSeminaire(cabinet.id, original.id, StatutSeminaire.PUBLIE);
    const participant = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: 'P', prenom: 'Q', email: `duplication.${Date.now()}@example.test` },
    });
    await inscrireParticipant({ seminaireId: original.id, participantId: participant.id, source: SourceInscription.MANUEL });

    const copie = await dupliquerSeminaire(cabinet.id, original.id);

    expect(copie!.id).not.toBe(original.id);
    expect(copie!.codePublic).not.toBe(original.codePublic);
    expect(copie!.statut).toBe(StatutSeminaire.BROUILLON);
    expect(copie!.inscriptionOuverte).toBe(false);

    const copieComplete = await obtenirSeminaire(cabinet.id, copie!.id);
    expect(copieComplete!.modules.map((m) => m.titre)).toEqual(['Module A', 'Module B']);
    expect(copieComplete!.formateurs.map((f) => f.utilisateurId)).toEqual([formateur.id]);

    const inscritsCopie = await prisma.inscription.count({ where: { seminaireId: copie!.id } });
    expect(inscritsCopie).toBe(0);
  });

  it("renvoie null pour un séminaire d'un autre cabinet", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const seminaire = await creerSeminaire(cabinetA.id, donneesDeBase());

    expect(await dupliquerSeminaire(cabinetB.id, seminaire.id)).toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
