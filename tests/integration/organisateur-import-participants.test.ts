import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, RoleUtilisateur, SourceInscription, StatutInscription, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';
import { inscrireParticipant, annulerInscription } from '../../src/lib/inscription';
import {
  ApercuImportIntrouvableError,
  CapaciteImportInsuffisanteError,
  PLAFOND_LIGNES,
  confirmerImportCsv,
  previsualiserImportCsv,
} from '../../src/lib/organisateur/import-participants';

async function creerCabinet() {
  return prisma.cabinet.create({ data: { nom: `Cabinet import ${Date.now()}-${Math.random()}` } });
}

async function creerOrganisateur(cabinetId: string) {
  return prisma.utilisateur.create({
    data: {
      cabinetId,
      email: `orga.import.${Date.now()}.${Math.random()}@example.test`,
      nom: 'Orga',
      prenom: 'Import',
      role: RoleUtilisateur.ORGANISATEUR,
      motDePasseHash: 'x',
    },
  });
}

async function creerSeminaire(cabinetId: string, capaciteMax: number | null = null) {
  return prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire import test',
      dateDebut: new Date('2027-04-01T09:00:00Z'),
      dateFin: new Date('2027-04-01T17:00:00Z'),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.PUBLIE,
      capaciteMax,
    },
  });
}

function csv(lignes: string[][]): Buffer {
  return Buffer.from(lignes.map((l) => l.join(';')).join('\n'), 'utf-8');
}

const ENTETE = ['Nom', 'Prénom', 'Email', 'Téléphone', 'Fonction', 'Organisation'];

describe('previsualiserImportCsv', () => {
  it('sépare correctement lignes valides, doublons du fichier, erreurs et déjà-inscrits', async () => {
    const cabinet = await creerCabinet();
    const organisateur = await creerOrganisateur(cabinet.id);
    const seminaire = await creerSeminaire(cabinet.id);
    const suffixe = `${Date.now()}.${Math.random()}`;

    const emailValide = `awa.diop.${suffixe}@x.sn`;
    const emailDejaInscrit = `deja.inscrit.${suffixe}@x.sn`;

    const participantExistant = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: 'Existant', prenom: 'Personne', email: emailDejaInscrit },
    });
    await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: participantExistant.id,
      source: SourceInscription.MANUEL,
      statutCible: StatutInscription.CONFIRMEE,
    });

    const buffer = csv([
      ENTETE,
      ['Diop', 'Awa', emailValide, '', '', ''], // ligne 2 : valide
      ['Diop', 'Awa', emailValide.toUpperCase(), '', '', ''], // ligne 3 : doublon fichier (même email normalisé)
      ['', 'Ibra', '', '', '', ''], // ligne 4 : erreur (nom manquant)
      ['Existant', 'Personne', emailDejaInscrit, '', '', ''], // ligne 5 : déjà inscrit à ce séminaire
    ]);

    const rapport = await previsualiserImportCsv(cabinet.id, seminaire.id, organisateur.id, buffer);
    expect(rapport).not.toBeNull();
    if (!rapport || 'erreurGlobale' in rapport) throw new Error('rapport attendu');

    expect(rapport.totalLignes).toBe(4);
    expect(rapport.lignesValides).toHaveLength(1);
    expect(rapport.lignesValides[0]).toMatchObject({ numeroLigne: 2, email: emailValide });
    expect(rapport.doublonsFichier).toEqual([{ numeroLigne: 3, premiereOccurrenceLigne: 2 }]);
    expect(rapport.erreurs).toHaveLength(1);
    expect(rapport.erreurs[0]!.numeroLigne).toBe(4);
    expect(rapport.dejaInscrites).toEqual([{ numeroLigne: 5, nom: 'Existant', prenom: 'Personne' }]);

    expect(rapport.apercuId).toBeTruthy();
    const enAttente = await prisma.importEnAttente.findUniqueOrThrow({ where: { id: rapport.apercuId! } });
    expect(enAttente.seminaireId).toBe(seminaire.id);
    expect(enAttente.utilisateurId).toBe(organisateur.id);
    expect(enAttente.expireLe.getTime()).toBeGreaterThan(Date.now() + 25 * 60 * 1000);
  });

  it("renvoie null pour un séminaire d'un autre cabinet", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const organisateur = await creerOrganisateur(cabinetB.id);
    const seminaire = await creerSeminaire(cabinetA.id);

    const resultat = await previsualiserImportCsv(cabinetB.id, seminaire.id, organisateur.id, csv([ENTETE, ['A', 'B', '', '', '', '']]));
    expect(resultat).toBeNull();
  });

  it('rejette un fichier dépassant PLAFOND_LIGNES, sans rien écrire', async () => {
    const cabinet = await creerCabinet();
    const organisateur = await creerOrganisateur(cabinet.id);
    const seminaire = await creerSeminaire(cabinet.id);

    const lignes = [ENTETE];
    for (let i = 0; i < PLAFOND_LIGNES + 1; i++) {
      lignes.push([`Nom${i}`, 'Prenom', '', `+22177000${String(i).padStart(4, '0')}`, '', '']);
    }

    const resultat = await previsualiserImportCsv(cabinet.id, seminaire.id, organisateur.id, csv(lignes));
    expect(resultat).not.toBeNull();
    expect(resultat && 'erreurGlobale' in resultat).toBe(true);

    const nbApercus = await prisma.importEnAttente.count({ where: { seminaireId: seminaire.id } });
    expect(nbApercus).toBe(0);
    const nbParticipants = await prisma.participant.count({ where: { cabinetId: cabinet.id } });
    expect(nbParticipants).toBe(0);
  });

  it('décode correctement un fichier Windows-1252 (accents hors plage Latin-1)', async () => {
    const cabinet = await creerCabinet();
    const organisateur = await creerOrganisateur(cabinet.id);
    const seminaire = await creerSeminaire(cabinet.id);
    const suffixe = `${Date.now()}.${Math.random()}`;

    // En-tête + une ligne "Cœur;Awa;email;;;;" où "œ" est encodé en
    // Windows-1252 (0x9C), jamais de l'UTF-8 valide.
    const entete = Buffer.from('Nom;Prenom;Email;Telephone;Fonction;Organisation\n', 'utf-8');
    const ligne = Buffer.concat([
      Buffer.from([0x43, 0x9c, 0x75, 0x72]), // "Cœur"
      Buffer.from(`;Awa;coeur.${suffixe}@x.sn;;;`, 'utf-8'),
    ]);
    const buffer = Buffer.concat([entete, ligne]);

    const rapport = await previsualiserImportCsv(cabinet.id, seminaire.id, organisateur.id, buffer);
    if (!rapport || 'erreurGlobale' in rapport) throw new Error('rapport attendu');
    expect(rapport.lignesValides).toHaveLength(1);
    expect(rapport.lignesValides[0]!.nom).toBe('Cœur');
  });
});

describe('confirmerImportCsv', () => {
  it('écrit exactement les lignes valides et supprime l\'ImportEnAttente', async () => {
    const cabinet = await creerCabinet();
    const organisateur = await creerOrganisateur(cabinet.id);
    const seminaire = await creerSeminaire(cabinet.id);
    const email = `confirme.${Date.now()}.${Math.random()}@x.sn`;

    const rapport = await previsualiserImportCsv(
      cabinet.id,
      seminaire.id,
      organisateur.id,
      csv([ENTETE, ['Diop', 'Awa', email, '', '', '']]),
    );
    if (!rapport || 'erreurGlobale' in rapport) throw new Error('rapport attendu');

    const resultat = await confirmerImportCsv(cabinet.id, seminaire.id, organisateur.id, rapport.apercuId!);
    expect(resultat).toEqual({ importes: 1, dejaInscrits: 0 });

    const inscription = await prisma.inscription.findFirstOrThrow({
      where: { seminaireId: seminaire.id, participant: { email } },
    });
    expect(inscription.statut).toBe(StatutInscription.CONFIRMEE);
    expect(inscription.source).toBe(SourceInscription.IMPORT);

    const enAttente = await prisma.importEnAttente.findUnique({ where: { id: rapport.apercuId! } });
    expect(enAttente).toBeNull();
  });

  it("capacité insuffisante : rien n'est écrit, l'aperçu survit, et une confirmation ultérieure réussit une fois la place libérée", async () => {
    const cabinet = await creerCabinet();
    const organisateur = await creerOrganisateur(cabinet.id);
    const seminaire = await creerSeminaire(cabinet.id, 1);

    const occupant = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: 'Occupant', prenom: 'Place', email: `occupant.${Date.now()}@x.sn` },
    });
    const inscriptionOccupante = await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: occupant.id,
      source: SourceInscription.MANUEL,
      statutCible: StatutInscription.CONFIRMEE,
    });

    const email = `capacite.${Date.now()}.${Math.random()}@x.sn`;
    const rapport = await previsualiserImportCsv(
      cabinet.id,
      seminaire.id,
      organisateur.id,
      csv([ENTETE, ['Nouveau', 'Venu', email, '', '', '']]),
    );
    if (!rapport || 'erreurGlobale' in rapport) throw new Error('rapport attendu');

    const participantsAvant = await prisma.participant.count({ where: { cabinetId: cabinet.id } });
    const inscriptionsAvant = await prisma.inscription.count({ where: { seminaireId: seminaire.id } });

    await expect(confirmerImportCsv(cabinet.id, seminaire.id, organisateur.id, rapport.apercuId!)).rejects.toThrow(
      CapaciteImportInsuffisanteError,
    );

    expect(await prisma.participant.count({ where: { cabinetId: cabinet.id } })).toBe(participantsAvant);
    expect(await prisma.inscription.count({ where: { seminaireId: seminaire.id } })).toBe(inscriptionsAvant);
    expect(await prisma.importEnAttente.findUnique({ where: { id: rapport.apercuId! } })).not.toBeNull();

    // Libère la place, puis retente SANS réimporter.
    await annulerInscription(inscriptionOccupante.id);
    const resultat = await confirmerImportCsv(cabinet.id, seminaire.id, organisateur.id, rapport.apercuId!);
    expect(resultat).toEqual({ importes: 1, dejaInscrits: 0 });
    expect(await prisma.importEnAttente.findUnique({ where: { id: rapport.apercuId! } })).toBeNull();
  });

  it('refuse un apercuId inexistant', async () => {
    const cabinet = await creerCabinet();
    const organisateur = await creerOrganisateur(cabinet.id);
    const seminaire = await creerSeminaire(cabinet.id);

    await expect(
      confirmerImportCsv(cabinet.id, seminaire.id, organisateur.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(ApercuImportIntrouvableError);
  });

  it('refuse un apercuId expiré, sans le supprimer', async () => {
    const cabinet = await creerCabinet();
    const organisateur = await creerOrganisateur(cabinet.id);
    const seminaire = await creerSeminaire(cabinet.id);

    const expire = await prisma.importEnAttente.create({
      data: {
        seminaireId: seminaire.id,
        utilisateurId: organisateur.id,
        donnees: [{ numeroLigne: 2, nom: 'X', prenom: 'Y', email: 'expire@x.sn', telephone: null, fonction: null, organisation: null }],
        expireLe: new Date(Date.now() - 1000),
      },
    });

    await expect(confirmerImportCsv(cabinet.id, seminaire.id, organisateur.id, expire.id)).rejects.toThrow(
      ApercuImportIntrouvableError,
    );
    expect(await prisma.importEnAttente.findUnique({ where: { id: expire.id } })).not.toBeNull();
  });

  it("refuse un apercuId appartenant à un autre séminaire", async () => {
    const cabinet = await creerCabinet();
    const organisateur = await creerOrganisateur(cabinet.id);
    const seminaireA = await creerSeminaire(cabinet.id);
    const seminaireB = await creerSeminaire(cabinet.id);

    const rapport = await previsualiserImportCsv(
      cabinet.id,
      seminaireA.id,
      organisateur.id,
      csv([ENTETE, ['X', 'Y', `autre.sem.${Date.now()}@x.sn`, '', '', '']]),
    );
    if (!rapport || 'erreurGlobale' in rapport) throw new Error('rapport attendu');

    await expect(confirmerImportCsv(cabinet.id, seminaireB.id, organisateur.id, rapport.apercuId!)).rejects.toThrow(
      ApercuImportIntrouvableError,
    );
  });

  it('refuse un apercuId du même cabinet mais appartenant à un autre utilisateur', async () => {
    const cabinet = await creerCabinet();
    const organisateurA = await creerOrganisateur(cabinet.id);
    const organisateurB = await creerOrganisateur(cabinet.id);
    const seminaire = await creerSeminaire(cabinet.id);

    const rapport = await previsualiserImportCsv(
      cabinet.id,
      seminaire.id,
      organisateurA.id,
      csv([ENTETE, ['X', 'Y', `autre.user.${Date.now()}@x.sn`, '', '', '']]),
    );
    if (!rapport || 'erreurGlobale' in rapport) throw new Error('rapport attendu');

    await expect(confirmerImportCsv(cabinet.id, seminaire.id, organisateurB.id, rapport.apercuId!)).rejects.toThrow(
      ApercuImportIntrouvableError,
    );
  });

  it("renvoie null pour un séminaire d'un autre cabinet (même si l'apercuId existe)", async () => {
    const cabinetA = await creerCabinet();
    const cabinetB = await creerCabinet();
    const organisateurA = await creerOrganisateur(cabinetA.id);
    const seminaire = await creerSeminaire(cabinetA.id);

    const rapport = await previsualiserImportCsv(
      cabinetA.id,
      seminaire.id,
      organisateurA.id,
      csv([ENTETE, ['X', 'Y', `autre.cabinet.${Date.now()}@x.sn`, '', '', '']]),
    );
    if (!rapport || 'erreurGlobale' in rapport) throw new Error('rapport attendu');

    const resultat = await confirmerImportCsv(cabinetB.id, seminaire.id, organisateurA.id, rapport.apercuId!);
    expect(resultat).toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
