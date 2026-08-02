import {
  Modalite,
  SourceInscription,
  StatutInscription,
  StatutQuestionnaire,
  StatutSeminaire,
  TypeQuestion,
} from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { genererCodePublicSeminaire, genererJetonInscription } from '../../src/lib/jeton';

/**
 * Fixtures e2e créées à la demande (beforeAll de chaque spec), jamais des
 * jetons/codes figés générés une fois puis réutilisés d'un run à l'autre :
 * une suite qui s'épuise après une exécution n'est pas rejouable et échoue
 * en CI dès la deuxième fois. Chaque fonction crée des lignes fraîches ;
 * `supprimerCabinetCompletement` nettoie tout ce qui en dépend, dans l'ordre
 * qu'imposent les contraintes de clé étrangère du schéma.
 */

export interface SeminaireOuvertFixture {
  cabinetId: string;
  seminaireId: string;
  codePublic: string;
}

export async function creerSeminaireOuvert(
  options: { couleurPrimaire?: string; nom?: string } = {},
): Promise<SeminaireOuvertFixture> {
  const cabinet = await prisma.cabinet.create({
    data: {
      nom: options.nom ?? `Cabinet e2e ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      couleurPrimaire: options.couleurPrimaire,
    },
  });

  const dansUnMois = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire e2e',
      description: 'Séminaire créé pour un test e2e — supprimé après la suite.',
      dateDebut: dansUnMois,
      dateFin: new Date(dansUnMois.getTime() + 8 * 3600 * 1000),
      lieu: 'Dakar',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 8,
      statut: StatutSeminaire.PUBLIE,
      inscriptionOuverte: true,
    },
  });

  return { cabinetId: cabinet.id, seminaireId: seminaire.id, codePublic: seminaire.codePublic };
}

export async function creerInscriptionAnnulee(fixture: SeminaireOuvertFixture): Promise<{ jeton: string }> {
  const participant = await prisma.participant.create({
    data: {
      cabinetId: fixture.cabinetId,
      nom: 'Annule',
      prenom: 'Test',
      email: `annule.e2e.${Date.now()}.${Math.random().toString(36).slice(2)}@example.test`,
    },
  });
  const jeton = genererJetonInscription();
  await prisma.inscription.create({
    data: {
      seminaireId: fixture.seminaireId,
      participantId: participant.id,
      jeton,
      statut: StatutInscription.ANNULEE,
      source: SourceInscription.MANUEL,
    },
  });
  return { jeton };
}

export interface SeminaireTermineAvecQuestionnaireFixture extends SeminaireOuvertFixture {
  questionnaireId: string;
}

/**
 * Séminaire déjà terminé (phase APRES) avec un questionnaire publié —
 * satisfaction (NOTE_5, obligatoire), NPS (optionnel), remarques libres
 * (optionnel). Chaque test qui répond crée sa propre inscription via
 * `creerInscriptionPourQuestionnaire` : jamais de jeton partagé entre tests.
 */
export async function creerSeminaireTermineAvecQuestionnaire(): Promise<SeminaireTermineAvecQuestionnaireFixture> {
  const cabinet = await prisma.cabinet.create({
    data: { nom: `Cabinet e2e questionnaire ${Date.now()}-${Math.random().toString(36).slice(2)}` },
  });

  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire e2e terminé',
      dateDebut: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      dateFin: new Date(Date.now() - 29 * 24 * 3600 * 1000),
      lieu: 'Dakar',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.CLOTURE,
      inscriptionOuverte: false,
    },
  });

  const questionnaire = await prisma.questionnaire.create({
    data: {
      cabinetId: cabinet.id,
      seminaireId: seminaire.id,
      titre: 'Évaluation e2e',
      statut: StatutQuestionnaire.PUBLIE,
    },
  });
  const section = await prisma.section.create({
    data: { questionnaireId: questionnaire.id, titre: 'Général', ordre: 1 },
  });
  await prisma.question.create({
    data: { sectionId: section.id, intitule: 'Satisfaction globale', type: TypeQuestion.NOTE_5, obligatoire: true, ordre: 1 },
  });
  await prisma.question.create({
    data: {
      sectionId: section.id,
      intitule: 'Recommanderiez-vous ce séminaire ?',
      type: TypeQuestion.NPS,
      obligatoire: false,
      ordre: 2,
    },
  });
  await prisma.question.create({
    data: { sectionId: section.id, intitule: 'Vos remarques libres', type: TypeQuestion.TEXTE_LIBRE, obligatoire: false, ordre: 3 },
  });

  return { cabinetId: cabinet.id, seminaireId: seminaire.id, codePublic: seminaire.codePublic, questionnaireId: questionnaire.id };
}

export async function creerInscriptionPourQuestionnaire(
  fixture: SeminaireTermineAvecQuestionnaireFixture,
): Promise<{ jeton: string }> {
  const participant = await prisma.participant.create({
    data: {
      cabinetId: fixture.cabinetId,
      nom: 'Repondant',
      prenom: 'E2E',
      email: `repondant.e2e.${Date.now()}.${Math.random().toString(36).slice(2)}@example.test`,
    },
  });
  const jeton = genererJetonInscription();
  await prisma.inscription.create({
    data: {
      seminaireId: fixture.seminaireId,
      participantId: participant.id,
      jeton,
      statut: StatutInscription.CONFIRMEE,
      source: SourceInscription.MANUEL,
    },
  });
  return { jeton };
}

/**
 * Nettoyage complet d'un cabinet créé pour un test, dans l'ordre qu'imposent
 * les contraintes de clé étrangère (Inscription avant Seminaire/Participant,
 * Soumission/Section avant Questionnaire, tout avant Cabinet...). Générique :
 * fonctionne quel que soit ce que le test a créé dessus.
 *
 * Consentement est une table en ajout seul (lot 1/2) : un trigger Postgres
 * interdit tout DELETE, sans exception pour des données de test — c'est
 * exactement la garantie qu'elle doit offrir, on ne la contourne pas ici. Un
 * test qui soumet une vraie inscription publique déclenche l'enregistrement
 * automatique d'un consentement (INSCRIPTION_EVALUATION), ce qui rend ce
 * cabinet définitivement non supprimable en cascade (Consentement → Restrict
 * sur Participant/Inscription → Restrict sur Seminaire/Cabinet). Dans ce cas,
 * on renonce au nettoyage plutôt que de le faire à moitié : les données
 * restent, comme elles le feraient de toute façon en production. Chaque
 * fixture utilise un cabinet et des emails générés aléatoirement (Date.now()
 * + suffixe), donc cette accumulation ne fait jamais échouer un rejeu — même
 * convention que les tests d'intégration vitest existants, qui ne suppriment
 * jamais leurs propres fixtures non plus.
 */
export async function supprimerCabinetCompletement(cabinetId: string): Promise<void> {
  const seminaires = await prisma.seminaire.findMany({ where: { cabinetId }, select: { id: true } });
  const seminaireIds = seminaires.map((s) => s.id);
  const questionnaires = await prisma.questionnaire.findMany({ where: { cabinetId }, select: { id: true } });
  const questionnaireIds = questionnaires.map((q) => q.id);

  const nbConsentements = await prisma.consentement.count({
    where: {
      OR: [
        { participant: { cabinetId } },
        { inscription: { seminaireId: { in: seminaireIds } } },
      ],
    },
  });
  if (nbConsentements > 0) return;

  await prisma.inscription.deleteMany({ where: { seminaireId: { in: seminaireIds } } });
  await prisma.seminaireFormateur.deleteMany({ where: { seminaireId: { in: seminaireIds } } });
  await prisma.module.deleteMany({ where: { seminaireId: { in: seminaireIds } } });

  // Soumission (cascade Reponse) et Section (cascade Question) avant Questionnaire.
  await prisma.soumission.deleteMany({ where: { questionnaireId: { in: questionnaireIds } } });
  await prisma.section.deleteMany({ where: { questionnaireId: { in: questionnaireIds } } });
  // Auto-référence modeleOrigineId : détacher avant de supprimer.
  await prisma.questionnaire.updateMany({ where: { id: { in: questionnaireIds } }, data: { modeleOrigineId: null } });
  await prisma.questionnaire.deleteMany({ where: { id: { in: questionnaireIds } } });

  await prisma.seminaire.deleteMany({ where: { id: { in: seminaireIds } } }); // cascade MessageAnonyme
  await prisma.participant.deleteMany({ where: { cabinetId } });
  await prisma.utilisateur.deleteMany({ where: { cabinetId } }); // cascade SessionOrganisateur/JetonActionUtilisateur
  await prisma.cabinet.delete({ where: { id: cabinetId } });
}
