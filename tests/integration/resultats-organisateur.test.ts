import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, RoleUtilisateur, StatutQuestionnaire, StatutSeminaire, TypeQuestion } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  genererCsvReponsesBrutes,
  genererCsvResultatsAgreges,
  obtenirResultatsSeminaire,
} from '../../src/lib/organisateur/resultats';
import { genererCodeFormateur, genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerCabinetAvecUtilisateurs() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test résultats organisateur' } });
  const organisateur = await prisma.utilisateur.create({
    data: { cabinetId: cabinet.id, email: `org-${cabinet.id}@test.local`, nom: 'Org', prenom: 'A', role: RoleUtilisateur.ORGANISATEUR },
  });
  const formateurAffecte = await prisma.utilisateur.create({
    data: { cabinetId: cabinet.id, email: `form-affecte-${cabinet.id}@test.local`, nom: 'Formateur', prenom: 'Affecté', role: RoleUtilisateur.FORMATEUR },
  });
  const formateurEtranger = await prisma.utilisateur.create({
    data: { cabinetId: cabinet.id, email: `form-etranger-${cabinet.id}@test.local`, nom: 'Formateur', prenom: 'Étranger', role: RoleUtilisateur.FORMATEUR },
  });
  return { cabinet, organisateur, formateurAffecte, formateurEtranger };
}

async function creerSeminaireAvecQuestionnaire(
  cabinetId: string,
  dateDebut: string,
  nbSoumissions: number,
  modeleOrigineId: string | null = null,
) {
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId,
      codePublic: genererCodePublicSeminaire(),
      titre: `Séminaire ${dateDebut}`,
      dateDebut: new Date(dateDebut),
      dateFin: new Date(dateDebut),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 4,
      statut: StatutSeminaire.PUBLIE,
      seuilAnonymat: 5,
    },
  });
  const questionnaire = await prisma.questionnaire.create({
    data: { cabinetId, seminaireId: seminaire.id, titre: 'Évaluation', statut: StatutQuestionnaire.PUBLIE, modeleOrigineId },
  });
  const section = await prisma.section.create({ data: { questionnaireId: questionnaire.id, titre: 'S1', ordre: 1 } });
  const question = await prisma.question.create({
    data: { sectionId: section.id, intitule: 'Satisfaction', type: TypeQuestion.NOTE_5, ordre: 1 },
  });

  for (let i = 0; i < nbSoumissions; i++) {
    const soumission = await prisma.soumission.create({ data: { questionnaireId: questionnaire.id } });
    await prisma.reponse.create({ data: { soumissionId: soumission.id, questionId: question.id, valeurNumerique: (i % 5) + 1 } });
  }

  return { seminaire, questionnaire };
}

describe('Résultats — accès organisateur/formateur et exports', () => {
  it('un formateur affecté au séminaire voit ses résultats, un formateur non affecté est traité comme si le séminaire n\'existait pas', async () => {
    const { cabinet, formateurAffecte, formateurEtranger } = await creerCabinetAvecUtilisateurs();
    const { seminaire } = await creerSeminaireAvecQuestionnaire(cabinet.id, '2026-05-01', 5);

    await prisma.seminaireFormateur.create({
      data: { seminaireId: seminaire.id, utilisateurId: formateurAffecte.id, roleFormateur: 'INTERVENANT', codeFormateur: genererCodeFormateur() },
    });

    const vuAffecte = await obtenirResultatsSeminaire(cabinet.id, seminaire.id, {
      utilisateurId: formateurAffecte.id,
      cabinetId: cabinet.id,
      role: RoleUtilisateur.FORMATEUR,
    });
    expect(vuAffecte).not.toBeNull();
    expect(vuAffecte?.visible).toBe(true);

    const vuEtranger = await obtenirResultatsSeminaire(cabinet.id, seminaire.id, {
      utilisateurId: formateurEtranger.id,
      cabinetId: cabinet.id,
      role: RoleUtilisateur.FORMATEUR,
    });
    expect(vuEtranger).toBeNull();
  });

  it("la comparaison n'apparaît qu'à partir de deux séminaires précédents du même modèle, ayant chacun atteint leur propre seuil", async () => {
    const { cabinet, organisateur } = await creerCabinetAvecUtilisateurs();

    // Un modèle réel dans la bibliothèque, pour porter modeleOrigineId.
    const modele = await prisma.questionnaire.create({
      data: { cabinetId: cabinet.id, estModele: true, nom: 'Modèle standard', titre: 'Modèle standard', statut: StatutQuestionnaire.BROUILLON },
    });

    const { seminaire: seminaireActuel } = await creerSeminaireAvecQuestionnaire(cabinet.id, '2026-06-01', 5, modele.id);

    const contexteOrganisateur = { utilisateurId: organisateur.id, cabinetId: cabinet.id, role: RoleUtilisateur.ORGANISATEUR };

    // Un seul précédent (même modèle, sous le seuil pour un cas, au-dessus pour l'autre) : pas encore de comparaison.
    await creerSeminaireAvecQuestionnaire(cabinet.id, '2026-01-01', 5, modele.id);
    const vuUnSeulPrecedent = await obtenirResultatsSeminaire(cabinet.id, seminaireActuel.id, contexteOrganisateur);
    expect(vuUnSeulPrecedent?.comparaison).toBeNull();

    // Un deuxième précédent, mais SOUS son propre seuil : ne doit pas compter (fuite indirecte sinon).
    await creerSeminaireAvecQuestionnaire(cabinet.id, '2026-02-01', 3, modele.id);
    const vuDeuxiemeSousLeSeuil = await obtenirResultatsSeminaire(cabinet.id, seminaireActuel.id, contexteOrganisateur);
    expect(vuDeuxiemeSousLeSeuil?.comparaison).toBeNull();

    // Un troisième précédent, au-dessus du seuil cette fois : deux précédents éligibles -> comparaison visible.
    await creerSeminaireAvecQuestionnaire(cabinet.id, '2026-03-01', 6, modele.id);
    const vuDeuxPrecedentsEligibles = await obtenirResultatsSeminaire(cabinet.id, seminaireActuel.id, contexteOrganisateur);
    expect(vuDeuxPrecedentsEligibles?.comparaison).not.toBeNull();
    expect(vuDeuxPrecedentsEligibles?.comparaison?.nbSeminairesPrecedents).toBe(2);
  });

  it("l'export brut ne contient ni identifiant de soumission, ni date, ni ordre stable — uniquement les intitulés en en-tête", async () => {
    const { cabinet, organisateur } = await creerCabinetAvecUtilisateurs();
    const { seminaire, questionnaire } = await creerSeminaireAvecQuestionnaire(cabinet.id, '2026-07-01', 5);
    const contexte = { utilisateurId: organisateur.id, cabinetId: cabinet.id, role: RoleUtilisateur.ORGANISATEUR };

    const soumissions = await prisma.soumission.findMany({ where: { questionnaireId: questionnaire.id }, select: { id: true } });

    const csv = await genererCsvReponsesBrutes(cabinet.id, seminaire.id, contexte);
    expect(csv).not.toBeNull();

    for (const s of soumissions) {
      expect(csv!.includes(s.id)).toBe(false);
    }
    expect(csv).not.toMatch(/\bdate\b/i);
    expect(csv).not.toMatch(/\bid\b/i);

    const lignes = csv!.trim().split('\r\n');
    expect(lignes[0]).toBe('Satisfaction');
    // Une ligne d'en-tête + une ligne par soumission.
    expect(lignes).toHaveLength(1 + soumissions.length);
  });

  it('aucun résultat exportable avant la première réponse (les deux exports) — même règle de visionnage que le recueil de besoins : pas de seuil, mais rien à montrer tant que personne n\'a répondu', async () => {
    const { cabinet, organisateur } = await creerCabinetAvecUtilisateurs();
    const { seminaire } = await creerSeminaireAvecQuestionnaire(cabinet.id, '2026-08-01', 0);
    const contexte = { utilisateurId: organisateur.id, cabinetId: cabinet.id, role: RoleUtilisateur.ORGANISATEUR };

    expect(await genererCsvResultatsAgreges(cabinet.id, seminaire.id, contexte)).toBeNull();
    expect(await genererCsvReponsesBrutes(cabinet.id, seminaire.id, contexte)).toBeNull();

    const vue = await obtenirResultatsSeminaire(cabinet.id, seminaire.id, contexte);
    expect(vue?.visible).toBe(false);
    expect(vue?.resultats).toBeNull();
  });

  it('les résultats sont visibles dès la première réponse, sans attendre le seuil configuré sur le séminaire', async () => {
    const { cabinet, organisateur } = await creerCabinetAvecUtilisateurs();
    const { seminaire } = await creerSeminaireAvecQuestionnaire(cabinet.id, '2026-08-02', 1);
    const contexte = { utilisateurId: organisateur.id, cabinetId: cabinet.id, role: RoleUtilisateur.ORGANISATEUR };

    const vue = await obtenirResultatsSeminaire(cabinet.id, seminaire.id, contexte);
    expect(vue?.visible).toBe(true);
    expect(vue?.resultats).not.toBeNull();
    expect(await genererCsvResultatsAgreges(cabinet.id, seminaire.id, contexte)).not.toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
