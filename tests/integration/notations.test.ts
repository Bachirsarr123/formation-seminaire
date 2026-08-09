import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, RoleUtilisateur, SourceInscription, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { enregistrerNotation, genererCsvNotations, obtenirNotationsSeminaire } from '../../src/lib/organisateur/notations';
import { inscrireParticipant } from '../../src/lib/inscription';
import { genererCodeFormateur, genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerCabinetComplet() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test notations' } });
  const organisateur = await prisma.utilisateur.create({
    data: { cabinetId: cabinet.id, email: `org-${cabinet.id}@test.local`, nom: 'Org', prenom: 'A', role: RoleUtilisateur.ORGANISATEUR },
  });
  const formateurAffecte = await prisma.utilisateur.create({
    data: { cabinetId: cabinet.id, email: `form-${cabinet.id}@test.local`, nom: 'Diallo', prenom: 'Issa', role: RoleUtilisateur.FORMATEUR },
  });
  const formateurEtranger = await prisma.utilisateur.create({
    data: { cabinetId: cabinet.id, email: `form-etr-${cabinet.id}@test.local`, nom: 'Sow', prenom: 'Fatou', role: RoleUtilisateur.FORMATEUR },
  });

  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire notation',
      dateDebut: new Date('2026-09-01'),
      dateFin: new Date('2026-09-01'),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.EN_COURS,
    },
  });
  await prisma.seminaireFormateur.create({
    data: { seminaireId: seminaire.id, utilisateurId: formateurAffecte.id, roleFormateur: 'PRINCIPAL', codeFormateur: genererCodeFormateur() },
  });

  const participant = await prisma.participant.create({
    data: { cabinetId: cabinet.id, nom: 'Ndiaye', prenom: 'Awa', email: `awa-${cabinet.id}@example.test` },
  });
  const inscription = await inscrireParticipant({
    seminaireId: seminaire.id,
    participantId: participant.id,
    source: SourceInscription.MANUEL,
  });

  return { cabinet, organisateur, formateurAffecte, formateurEtranger, seminaire, participant, inscription };
}

const contexte = (utilisateurId: string, cabinetId: string, role: RoleUtilisateur) => ({ utilisateurId, cabinetId, role });

describe('Notation formateur', () => {
  it('un formateur note un participant avec type, valeur, barème et justification', async () => {
    const { cabinet, formateurAffecte, seminaire, inscription } = await creerCabinetComplet();

    const resultat = await enregistrerNotation(
      cabinet.id,
      seminaire.id,
      inscription.id,
      contexte(formateurAffecte.id, cabinet.id, RoleUtilisateur.FORMATEUR),
      { typeNotation: 'TEST', valeur: 14, bareme: 20, justification: 'Bonne maîtrise des cas pratiques présentés.' },
    );
    expect(resultat.ok).toBe(true);

    const notation = await prisma.notation.findUnique({ where: { inscriptionId: inscription.id } });
    expect(notation?.typeNotation).toBe('TEST');
    expect(notation?.valeur).toBe(14);
    expect(notation?.bareme).toBe(20);
    expect(notation?.formateurId).toBe(formateurAffecte.id);
  });

  it('sans justification (ou trop courte) : refusé, aucune ligne créée', async () => {
    const { cabinet, formateurAffecte, seminaire, inscription } = await creerCabinetComplet();

    const vide = await enregistrerNotation(
      cabinet.id,
      seminaire.id,
      inscription.id,
      contexte(formateurAffecte.id, cabinet.id, RoleUtilisateur.FORMATEUR),
      { typeNotation: 'PRESENCE', valeur: 1, bareme: 1, justification: '' },
    );
    expect(vide.ok).toBe(false);

    const courte = await enregistrerNotation(
      cabinet.id,
      seminaire.id,
      inscription.id,
      contexte(formateurAffecte.id, cabinet.id, RoleUtilisateur.FORMATEUR),
      { typeNotation: 'PRESENCE', valeur: 1, bareme: 1, justification: 'Ok.' },
    );
    expect(courte.ok).toBe(false);

    expect(await prisma.notation.findUnique({ where: { inscriptionId: inscription.id } })).toBeNull();
  });

  it("un formateur ne peut noter que ses propres séminaires — un formateur non affecté est refusé", async () => {
    const { cabinet, formateurEtranger, seminaire, inscription } = await creerCabinetComplet();

    const resultat = await enregistrerNotation(
      cabinet.id,
      seminaire.id,
      inscription.id,
      contexte(formateurEtranger.id, cabinet.id, RoleUtilisateur.FORMATEUR),
      { typeNotation: 'TEST', valeur: 10, bareme: 20, justification: 'Tentative non autorisée sur ce séminaire.' },
    );
    expect(resultat.ok).toBe(false);
    expect(await prisma.notation.findUnique({ where: { inscriptionId: inscription.id } })).toBeNull();

    const vue = await obtenirNotationsSeminaire(cabinet.id, seminaire.id, contexte(formateurEtranger.id, cabinet.id, RoleUtilisateur.FORMATEUR));
    expect(vue).toBeNull();
  });

  it("un organisateur ne peut pas noter (lecture seule) — seul un formateur note", async () => {
    const { cabinet, organisateur, seminaire, inscription } = await creerCabinetComplet();

    const resultat = await enregistrerNotation(
      cabinet.id,
      seminaire.id,
      inscription.id,
      contexte(organisateur.id, cabinet.id, RoleUtilisateur.ORGANISATEUR),
      { typeNotation: 'TEST', valeur: 10, bareme: 20, justification: "Tentative d'un organisateur, doit échouer." },
    );
    expect(resultat.ok).toBe(false);

    // Mais l'organisateur voit bien l'écran (lecture) :
    const vue = await obtenirNotationsSeminaire(cabinet.id, seminaire.id, contexte(organisateur.id, cabinet.id, RoleUtilisateur.ORGANISATEUR));
    expect(vue).not.toBeNull();
    expect(vue?.peutNoter).toBe(false);
  });

  it("isolation par cabinet : un séminaire d'un autre cabinet est introuvable", async () => {
    const { formateurAffecte, seminaire, inscription } = await creerCabinetComplet();
    const autreCabinet = await prisma.cabinet.create({ data: { nom: 'Autre cabinet' } });

    const resultat = await enregistrerNotation(
      autreCabinet.id,
      seminaire.id,
      inscription.id,
      contexte(formateurAffecte.id, autreCabinet.id, RoleUtilisateur.FORMATEUR),
      { typeNotation: 'TEST', valeur: 10, bareme: 20, justification: 'Tentative inter-cabinet, doit échouer.' },
    );
    expect(resultat.ok).toBe(false);

    const vue = await obtenirNotationsSeminaire(autreCabinet.id, seminaire.id, contexte(formateurAffecte.id, autreCabinet.id, RoleUtilisateur.FORMATEUR));
    expect(vue).toBeNull();
  });

  it("la note est modifiable tant que le séminaire n'est pas archivé, plus après", async () => {
    const { cabinet, formateurAffecte, seminaire, inscription } = await creerCabinetComplet();
    const ctxFormateur = contexte(formateurAffecte.id, cabinet.id, RoleUtilisateur.FORMATEUR);

    const premiere = await enregistrerNotation(cabinet.id, seminaire.id, inscription.id, ctxFormateur, {
      typeNotation: 'PRESENCE',
      valeur: 1,
      bareme: 1,
      justification: 'Présent toute la durée du séminaire.',
    });
    expect(premiere.ok).toBe(true);

    // Modification avant archivage : autorisée, remplace la ligne (upsert).
    const modifiee = await enregistrerNotation(cabinet.id, seminaire.id, inscription.id, ctxFormateur, {
      typeNotation: 'TEST',
      valeur: 16,
      bareme: 20,
      justification: 'Correction après réévaluation du test écrit.',
    });
    expect(modifiee.ok).toBe(true);
    const apresModification = await prisma.notation.findUnique({ where: { inscriptionId: inscription.id } });
    expect(apresModification?.typeNotation).toBe('TEST');
    expect(await prisma.notation.count({ where: { inscriptionId: inscription.id } })).toBe(1);

    await prisma.seminaire.update({ where: { id: seminaire.id }, data: { statut: StatutSeminaire.ARCHIVE } });

    const apresArchivage = await enregistrerNotation(cabinet.id, seminaire.id, inscription.id, ctxFormateur, {
      typeNotation: 'TEST',
      valeur: 18,
      bareme: 20,
      justification: 'Nouvelle tentative après archivage, doit échouer.',
    });
    expect(apresArchivage.ok).toBe(false);

    const vue = await obtenirNotationsSeminaire(cabinet.id, seminaire.id, ctxFormateur);
    expect(vue?.peutNoter).toBe(false);
  });

  it('APPRECIATION ne porte jamais de valeur ni de barème, même si le formulaire en envoie', async () => {
    const { cabinet, formateurAffecte, seminaire, inscription } = await creerCabinetComplet();

    const resultat = await enregistrerNotation(
      cabinet.id,
      seminaire.id,
      inscription.id,
      contexte(formateurAffecte.id, cabinet.id, RoleUtilisateur.FORMATEUR),
      { typeNotation: 'APPRECIATION', valeur: 15, bareme: 20, justification: "Participant très investi, force de proposition durant les ateliers." },
    );
    expect(resultat.ok).toBe(true);

    const notation = await prisma.notation.findUnique({ where: { inscriptionId: inscription.id } });
    expect(notation?.valeur).toBeNull();
    expect(notation?.bareme).toBeNull();
  });

  it("l'export contient toutes les colonnes attendues (nom, prénom, type, valeur, barème, justification)", async () => {
    const { cabinet, formateurAffecte, seminaire, inscription } = await creerCabinetComplet();

    await enregistrerNotation(cabinet.id, seminaire.id, inscription.id, contexte(formateurAffecte.id, cabinet.id, RoleUtilisateur.FORMATEUR), {
      typeNotation: 'TEST',
      valeur: 17,
      bareme: 20,
      justification: 'Excellente restitution lors de la mise en situation finale.',
    });

    const csv = await genererCsvNotations(cabinet.id, seminaire.id, contexte(formateurAffecte.id, cabinet.id, RoleUtilisateur.FORMATEUR));
    expect(csv).not.toBeNull();

    const lignes = csv!.trim().split('\r\n');
    expect(lignes[0]).toBe('Nom;Prénom;Type de notation;Valeur;Barème;Justification');
    expect(lignes[1]).toContain('Ndiaye');
    expect(lignes[1]).toContain('Awa');
    expect(lignes[1]).toContain('Test');
    expect(lignes[1]).toContain('17');
    expect(lignes[1]).toContain('20');
    expect(lignes[1]).toContain('Excellente restitution');
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
