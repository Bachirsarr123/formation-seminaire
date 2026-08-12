import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, RoleUtilisateur, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { resoudreContexteLienFormateur } from '../../src/lib/formateur-lien';
import { chargerReponsesRecueilParSeminaire } from '../../src/lib/recueil/consultation';
import { genererCodeAccesRecueil, genererCodeConsultationRecueil, genererCodeFormateur, genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerCabinetSeminaireFormateur(overrides: { formateurActif?: boolean } = {}) {
  const cabinet = await prisma.cabinet.create({ data: { nom: `Cabinet lien formateur ${Date.now()}-${Math.random()}` } });
  const formateur = await prisma.utilisateur.create({
    data: {
      cabinetId: cabinet.id,
      email: `formateur.lien.${Date.now()}.${Math.random()}@example.test`,
      nom: 'Camara',
      prenom: 'Issa',
      role: RoleUtilisateur.FORMATEUR,
      motDePasseHash: null,
      actif: overrides.formateurActif ?? true,
    },
  });
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire lien formateur',
      dateDebut: new Date('2026-11-01T09:00:00Z'),
      dateFin: new Date('2026-11-01T17:00:00Z'),
      lieu: 'Dakar',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.PUBLIE,
    },
  });
  const codeFormateur = genererCodeFormateur();
  await prisma.seminaireFormateur.create({
    data: { seminaireId: seminaire.id, utilisateurId: formateur.id, roleFormateur: 'PRINCIPAL', codeFormateur },
  });

  return { cabinet, formateur, seminaire, codeFormateur };
}

describe('resoudreContexteLienFormateur', () => {
  it('résout le séminaire et le formateur pour un code valide', async () => {
    const { cabinet, formateur, seminaire, codeFormateur } = await creerCabinetSeminaireFormateur();

    const contexte = await resoudreContexteLienFormateur(codeFormateur);

    expect(contexte).not.toBeNull();
    expect(contexte!.utilisateurId).toBe(formateur.id);
    expect(contexte!.cabinetId).toBe(cabinet.id);
    expect(contexte!.seminaire.id).toBe(seminaire.id);
    expect(contexte!.formateur).toEqual({ nom: 'Camara', prenom: 'Issa', cvUrl: null });
  });

  it('renvoie null pour un code inconnu', async () => {
    expect(await resoudreContexteLienFormateur('code-qui-nexiste-pas')).toBeNull();
  });

  it('renvoie null si le compte formateur a été désactivé', async () => {
    const { codeFormateur } = await creerCabinetSeminaireFormateur({ formateurActif: false });
    expect(await resoudreContexteLienFormateur(codeFormateur)).toBeNull();
  });

  it('renvoie null si le séminaire a été supprimé logiquement', async () => {
    const { seminaire, codeFormateur } = await creerCabinetSeminaireFormateur();
    await prisma.seminaire.update({ where: { id: seminaire.id }, data: { supprimeLe: new Date() } });

    expect(await resoudreContexteLienFormateur(codeFormateur)).toBeNull();
  });
});

describe('chargerReponsesRecueilParSeminaire', () => {
  it('renvoie les réponses sans identité (nom/prénom/fonction/organisation), résolu par seminaireId', async () => {
    const { cabinet, seminaire } = await creerCabinetSeminaireFormateur();
    const recueil = await prisma.recueil.create({
      data: {
        seminaireId: seminaire.id,
        cabinetId: cabinet.id,
        titre: 'Recueil test',
        description: 'Objectif',
        codeAcces: genererCodeAccesRecueil(),
        codeConsultation: genererCodeConsultationRecueil(),
        questions: { create: [{ intitule: 'Vos attentes ?', type: 'TEXTE_LIBRE', ordre: 1 }] },
      },
      include: { questions: true },
    });
    await prisma.recueilReponse.create({
      data: {
        recueilId: recueil.id,
        nom: 'Diop',
        prenom: 'Awa',
        fonction: 'Comptable',
        organisation: 'ACME',
        reponses: { [recueil.questions[0]!.id]: 'Plus de pratique.' },
      },
    });

    const charge = await chargerReponsesRecueilParSeminaire(seminaire.id);

    expect(charge).not.toBeNull();
    expect(charge!.reponses).toHaveLength(1);
    const reponse = charge!.reponses[0] as unknown as Record<string, unknown>;
    expect(reponse['nom']).toBeUndefined();
    expect(reponse['prenom']).toBeUndefined();
    expect(reponse['fonction']).toBeUndefined();
    expect(reponse['organisation']).toBeUndefined();
  });

  it("renvoie null si le séminaire n'a pas de recueil", async () => {
    const { seminaire } = await creerCabinetSeminaireFormateur();
    expect(await chargerReponsesRecueilParSeminaire(seminaire.id)).toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
