import { afterAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import { Modalite, RoleUtilisateur, SourceInscription, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  AutoDesactivationError,
  AutoSuppressionError,
  DernierOrganisateurActifError,
  EmailDejaUtiliseError,
  SuppressionImpossibleError,
  creerFormateur,
  creerOrganisateur,
  desactiverCompte,
  listerEquipe,
  modifierMembre,
  supprimerMembre,
} from '../../src/lib/organisateur/equipe';
import { enregistrerNotation } from '../../src/lib/organisateur/notations';
import { inscrireParticipant } from '../../src/lib/inscription';
import { genererCodeFormateur, genererCodePublicSeminaire } from '../../src/lib/jeton';

/**
 * Lot 4, étape 9 (gestion des comptes du cabinet). Même règle B que
 * seminaires.ts/participants.ts : cabinetId obligatoire, appliqué en clause
 * WHERE — voir aussi le pointeur dans organisateur-isolation.test.ts
 * (checklist étape 8, tenue à jour).
 */

async function creerCabinet(nom: string) {
  return prisma.cabinet.create({ data: { nom } });
}

async function creerOrganisateurDirect(cabinetId: string, suffixe: string) {
  return prisma.utilisateur.create({
    data: {
      cabinetId,
      email: `orga.${suffixe}.${Date.now()}@example.test`,
      nom: 'Ndiaye',
      prenom: 'Awa',
      role: RoleUtilisateur.ORGANISATEUR,
      motDePasseHash: 'x',
    },
  });
}

describe('creerFormateur', () => {
  it('crée un compte FORMATEUR sans mot de passe, actif par défaut', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — création');

    const formateur = await creerFormateur(cabinet.id, {
      nom: 'Camara',
      prenom: 'Issa',
      email: `issa.${Date.now()}@example.test`,
    });

    expect(formateur.role).toBe(RoleUtilisateur.FORMATEUR);
    expect(formateur.motDePasseHash).toBeNull();
    expect(formateur.actif).toBe(true);
    expect(formateur.cabinetId).toBe(cabinet.id);
  });

  it("refuse un e-mail déjà utilisé par un compte du MÊME cabinet, avec une erreur dédiée", async () => {
    const cabinet = await creerCabinet('Cabinet équipe — doublon même cabinet');
    const email = `doublon.${Date.now()}@example.test`;
    await creerFormateur(cabinet.id, { nom: 'Fall', prenom: 'A', email });

    await expect(creerFormateur(cabinet.id, { nom: 'Fall', prenom: 'B', email })).rejects.toThrow(
      EmailDejaUtiliseError,
    );
  });

  it("refuse un e-mail déjà utilisé par un compte d'un AUTRE cabinet — l'unicité est globale (schema.prisma)", async () => {
    const cabinetA = await creerCabinet('Cabinet équipe — doublon cross A');
    const cabinetB = await creerCabinet('Cabinet équipe — doublon cross B');
    const email = `cross-cabinet.${Date.now()}@example.test`;
    await creerFormateur(cabinetA.id, { nom: 'Ndiaye', prenom: 'A', email });

    await expect(creerFormateur(cabinetB.id, { nom: 'Ndiaye', prenom: 'B', email })).rejects.toThrow(
      EmailDejaUtiliseError,
    );
  });
});

describe('listerEquipe', () => {
  it('ne retourne jamais un membre d\'un autre cabinet, et inclut actifs et désactivés', async () => {
    const cabinetA = await creerCabinet('Cabinet équipe — liste A');
    const cabinetB = await creerCabinet('Cabinet équipe — liste B');

    const membreA = await creerFormateur(cabinetA.id, { nom: 'Sarr', prenom: 'A', email: `liste.a.${Date.now()}@example.test` });
    const membreB = await creerFormateur(cabinetB.id, { nom: 'Sarr', prenom: 'B', email: `liste.b.${Date.now()}@example.test` });
    await desactiverCompte(cabinetA.id, membreA.id, 'quelqu-un-d-autre');

    const listeA = await listerEquipe(cabinetA.id);

    expect(listeA.map((m) => m.id)).toContain(membreA.id);
    expect(listeA.map((m) => m.id)).not.toContain(membreB.id);
    expect(listeA.find((m) => m.id === membreA.id)?.actif).toBe(false);
  });
});

describe('desactiverCompte', () => {
  it('pose actif=false et ne supprime jamais la ligne', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — désactivation');
    const formateur = await creerFormateur(cabinet.id, { nom: 'Ba', prenom: 'C', email: `desact.${Date.now()}@example.test` });

    const resultat = await desactiverCompte(cabinet.id, formateur.id, 'un-autre-utilisateur');

    expect(resultat).toBe(true);
    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: formateur.id } });
    expect(relu.actif).toBe(false);
  });

  it("ne désactive jamais un compte d'un autre cabinet (isolation)", async () => {
    const cabinetA = await creerCabinet('Cabinet équipe — isolation A');
    const cabinetB = await creerCabinet('Cabinet équipe — isolation B');
    const formateurB = await creerFormateur(cabinetB.id, { nom: 'Diallo', prenom: 'D', email: `isolation.${Date.now()}@example.test` });

    const resultat = await desactiverCompte(cabinetA.id, formateurB.id, 'un-autre-utilisateur');

    expect(resultat).toBe(false);
    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: formateurB.id } });
    expect(relu.actif).toBe(true);
  });

  it('refuse qu\'un compte se désactive lui-même', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — auto-désactivation');
    const organisateur = await prisma.utilisateur.create({
      data: {
        cabinetId: cabinet.id,
        email: `auto.${Date.now()}@example.test`,
        nom: 'Ndiaye',
        prenom: 'Awa',
        role: RoleUtilisateur.ORGANISATEUR,
        motDePasseHash: 'x',
      },
    });

    await expect(desactiverCompte(cabinet.id, organisateur.id, organisateur.id)).rejects.toThrow(
      AutoDesactivationError,
    );
    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: organisateur.id } });
    expect(relu.actif).toBe(true);
  });
});

describe('creerOrganisateur', () => {
  it('crée un compte ORGANISATEUR avec un mot de passe haché (argon2), actif par défaut', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — création organisateur');

    const organisateur = await creerOrganisateur(cabinet.id, {
      nom: 'Ndiaye',
      prenom: 'Awa',
      email: `orga.creation.${Date.now()}@example.test`,
      motDePasse: 'un-mot-de-passe-solide',
    });

    expect(organisateur.role).toBe(RoleUtilisateur.ORGANISATEUR);
    expect(organisateur.actif).toBe(true);
    expect(organisateur.motDePasseHash).not.toBeNull();
    expect(organisateur.motDePasseHash).not.toBe('un-mot-de-passe-solide');
    expect(await argon2.verify(organisateur.motDePasseHash!, 'un-mot-de-passe-solide')).toBe(true);
  });

  it('refuse un e-mail déjà utilisé, avec la même erreur dédiée que pour un formateur', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — doublon organisateur');
    const email = `orga.doublon.${Date.now()}@example.test`;
    await creerOrganisateur(cabinet.id, { nom: 'A', prenom: 'A', email, motDePasse: 'un-mot-de-passe-solide' });

    await expect(
      creerOrganisateur(cabinet.id, { nom: 'B', prenom: 'B', email, motDePasse: 'un-autre-mot-de-passe' }),
    ).rejects.toThrow(EmailDejaUtiliseError);
  });
});

describe('modifierMembre', () => {
  it('met à jour nom/prénom/e-mail, quel que soit le rôle', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — modification');
    const formateur = await creerFormateur(cabinet.id, { nom: 'Ba', prenom: 'C', email: `modif.${Date.now()}@example.test` });

    const nouvelEmail = `modif.nouveau.${Date.now()}@example.test`;
    const ok = await modifierMembre(cabinet.id, formateur.id, { nom: 'Diop', prenom: 'Modifié', email: nouvelEmail });

    expect(ok).toBe(true);
    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: formateur.id } });
    expect(relu.nom).toBe('Diop');
    expect(relu.prenom).toBe('Modifié');
    expect(relu.email).toBe(nouvelEmail);
  });

  it("refuse de modifier vers un e-mail déjà utilisé par un autre compte", async () => {
    const cabinet = await creerCabinet('Cabinet équipe — modification doublon');
    const emailExistant = `modif.existant.${Date.now()}@example.test`;
    await creerFormateur(cabinet.id, { nom: 'A', prenom: 'A', email: emailExistant });
    const cible = await creerFormateur(cabinet.id, { nom: 'B', prenom: 'B', email: `modif.cible.${Date.now()}@example.test` });

    await expect(modifierMembre(cabinet.id, cible.id, { nom: 'B', prenom: 'B', email: emailExistant })).rejects.toThrow(
      EmailDejaUtiliseError,
    );
  });

  it("ne modifie jamais un compte d'un autre cabinet (isolation)", async () => {
    const cabinetA = await creerCabinet('Cabinet équipe — modif isolation A');
    const cabinetB = await creerCabinet('Cabinet équipe — modif isolation B');
    const formateurB = await creerFormateur(cabinetB.id, { nom: 'Diallo', prenom: 'D', email: `modif.iso.${Date.now()}@example.test` });

    const ok = await modifierMembre(cabinetA.id, formateurB.id, { nom: 'Changé', prenom: 'X', email: `x.${Date.now()}@example.test` });

    expect(ok).toBe(false);
    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: formateurB.id } });
    expect(relu.nom).toBe('Diallo');
  });
});

describe('supprimerMembre', () => {
  it('supprime physiquement un formateur sans données associées', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — suppression');
    const initiateur = await creerOrganisateurDirect(cabinet.id, 'suppr-initiateur');
    const formateur = await creerFormateur(cabinet.id, { nom: 'Sow', prenom: 'F', email: `suppr.${Date.now()}@example.test` });

    const ok = await supprimerMembre(cabinet.id, formateur.id, initiateur.id);

    expect(ok).toBe(true);
    expect(await prisma.utilisateur.findUnique({ where: { id: formateur.id } })).toBeNull();
  });

  it("ne supprime jamais un compte d'un autre cabinet (isolation)", async () => {
    const cabinetA = await creerCabinet('Cabinet équipe — suppr isolation A');
    const cabinetB = await creerCabinet('Cabinet équipe — suppr isolation B');
    const initiateurA = await creerOrganisateurDirect(cabinetA.id, 'suppr-iso-initiateur');
    const formateurB = await creerFormateur(cabinetB.id, { nom: 'Etranger', prenom: 'F', email: `suppr.iso.${Date.now()}@example.test` });

    const ok = await supprimerMembre(cabinetA.id, formateurB.id, initiateurA.id);

    expect(ok).toBe(false);
    expect(await prisma.utilisateur.findUnique({ where: { id: formateurB.id } })).not.toBeNull();
  });

  it('refuse qu\'un compte se supprime lui-même', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — auto-suppression');
    const organisateur = await creerOrganisateurDirect(cabinet.id, 'auto-suppr');

    await expect(supprimerMembre(cabinet.id, organisateur.id, organisateur.id)).rejects.toThrow(AutoSuppressionError);
    expect(await prisma.utilisateur.findUnique({ where: { id: organisateur.id } })).not.toBeNull();
  });

  it('refuse de supprimer le dernier organisateur actif du cabinet', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — dernier organisateur');
    const initiateur = await creerOrganisateurDirect(cabinet.id, 'dernier-initiateur');
    const seulOrganisateur = await creerOrganisateurDirect(cabinet.id, 'dernier-cible');
    // Ramène le cabinet à un seul organisateur actif : l'initiateur ne compte
    // pas (désactivé), seulOrganisateur serait alors le dernier actif.
    await desactiverCompte(cabinet.id, initiateur.id, 'quelqu-un-d-autre');

    await expect(supprimerMembre(cabinet.id, seulOrganisateur.id, 'quelqu-un-d-autre')).rejects.toThrow(
      DernierOrganisateurActifError,
    );
    expect(await prisma.utilisateur.findUnique({ where: { id: seulOrganisateur.id } })).not.toBeNull();
  });

  it('autorise la suppression d\'un organisateur si un autre organisateur actif reste dans le cabinet', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — organisateur restant');
    const initiateur = await creerOrganisateurDirect(cabinet.id, 'restant-initiateur');
    const autreOrganisateur = await creerOrganisateurDirect(cabinet.id, 'restant-cible');

    const ok = await supprimerMembre(cabinet.id, autreOrganisateur.id, initiateur.id);

    expect(ok).toBe(true);
    expect(await prisma.utilisateur.findUnique({ where: { id: autreOrganisateur.id } })).toBeNull();
  });

  it('refuse de supprimer un formateur qui a déjà noté un participant (contrainte Notation.formateur, Restrict) — la désactivation reste possible', async () => {
    const cabinet = await creerCabinet('Cabinet équipe — suppression bloquée par notation');
    const initiateur = await creerOrganisateurDirect(cabinet.id, 'bloque-initiateur');
    const formateur = await creerFormateur(cabinet.id, { nom: 'Note', prenom: 'F', email: `bloque.${Date.now()}@example.test` });

    const seminaire = await prisma.seminaire.create({
      data: {
        cabinetId: cabinet.id,
        codePublic: genererCodePublicSeminaire(),
        titre: 'Séminaire suppression bloquée',
        dateDebut: new Date('2026-09-01'),
        dateFin: new Date('2026-09-01'),
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 7,
        statut: StatutSeminaire.EN_COURS,
      },
    });
    await prisma.seminaireFormateur.create({
      data: { seminaireId: seminaire.id, utilisateurId: formateur.id, roleFormateur: 'PRINCIPAL', codeFormateur: genererCodeFormateur() },
    });
    const participant = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: 'Ndiaye', prenom: 'Awa', email: `bloque.participant.${Date.now()}@example.test` },
    });
    const inscription = await inscrireParticipant({
      seminaireId: seminaire.id,
      participantId: participant.id,
      source: SourceInscription.MANUEL,
    });
    await enregistrerNotation(
      cabinet.id,
      seminaire.id,
      inscription.id,
      { utilisateurId: formateur.id, cabinetId: cabinet.id, role: RoleUtilisateur.FORMATEUR },
      { typeNotation: 'PRESENCE', valeur: 1, bareme: 1, justification: 'Présent toute la journée.' },
    );

    await expect(supprimerMembre(cabinet.id, formateur.id, initiateur.id)).rejects.toThrow(SuppressionImpossibleError);
    expect(await prisma.utilisateur.findUnique({ where: { id: formateur.id } })).not.toBeNull();

    // La désactivation, elle, reste possible pour ce même compte.
    expect(await desactiverCompte(cabinet.id, formateur.id, initiateur.id)).toBe(true);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
