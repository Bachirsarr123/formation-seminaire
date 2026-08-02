// Script jetable pour la vérification navigateur manuelle : crée des
// séminaires avec des dates futures et trois couleurs d'accent distinctes.
// Les séminaires du seed (lot 1) ont tous des dates déjà passées relativement
// à aujourd'hui — inutilisables pour tester le parcours d'inscription ouvert.
import {
  PrismaClient,
  Modalite,
  StatutSeminaire,
  StatutQuestionnaire,
  TypeQuestion,
  SourceInscription,
  StatutInscription,
} from '@prisma/client';
import { genererCodePublicSeminaire, genererJetonInscription } from '../src/lib/jeton';
import { verifierEnvironnementDev } from '../src/lib/garde-environnement-dev';
import { copierModeleVersSeminaire } from '../src/lib/questionnaire/copier-modele';

try {
  process.loadEnvFile('.env');
} catch {
  // .env absent : on suppose DATABASE_URL déjà dans l'environnement.
}
verifierEnvironnementDev('fixtures-qa.ts');

const prisma = new PrismaClient();

async function main() {
  const dansUnMois = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const dansUnMoisSoir = new Date(dansUnMois.getTime() + 8 * 3600 * 1000);

  const bleu = await prisma.cabinet.create({
    data: { nom: 'Cabinet QA Bleu', couleurPrimaire: '#0B3D91', emailContact: 'contact@qa-bleu.test', telephoneContact: '+221 33 123 45 67' },
  });
  const vert = await prisma.cabinet.create({
    data: { nom: 'Cabinet QA Vert', couleurPrimaire: '#16A34A', emailContact: 'contact@qa-vert.test' },
  });
  const orange = await prisma.cabinet.create({
    data: { nom: 'Cabinet QA Orange', couleurPrimaire: '#F97316', emailContact: 'contact@qa-orange.test' },
  });

  async function creerSeminaireOuvert(cabinetId: string, titre: string) {
    return prisma.seminaire.create({
      data: {
        cabinetId,
        codePublic: genererCodePublicSeminaire(),
        titre,
        description: 'Séminaire de vérification navigateur (QA), à supprimer après.',
        dateDebut: dansUnMois,
        dateFin: dansUnMoisSoir,
        lieu: 'Dakar',
        modalite: Modalite.PRESENTIEL,
        dureeHeures: 8,
        statut: StatutSeminaire.PUBLIE,
        inscriptionOuverte: true,
      },
    });
  }

  const sBleu = await creerSeminaireOuvert(bleu.id, 'QA — Séminaire accent bleu foncé');
  const sVert = await creerSeminaireOuvert(vert.id, 'QA — Séminaire accent vert vif');
  const sOrange = await creerSeminaireOuvert(orange.id, 'QA — Séminaire accent orange');

  await prisma.module.create({ data: { seminaireId: sBleu.id, titre: 'Accueil', dureeMinutes: 30, ordre: 1 } });
  await prisma.module.create({ data: { seminaireId: sBleu.id, titre: 'Atelier pratique', dureeMinutes: 180, ordre: 2 } });

  // Séminaire complet (0 place restante)
  const sComplet = await creerSeminaireOuvert(bleu.id, 'QA — Séminaire complet');
  await prisma.seminaire.update({ where: { id: sComplet.id }, data: { capaciteMax: 1 } });
  const pComplet = await prisma.participant.create({
    data: { cabinetId: bleu.id, nom: 'Complet', prenom: 'Test', email: 'qa.complet@example.test' },
  });
  await prisma.inscription.create({
    data: {
      seminaireId: sComplet.id,
      participantId: pComplet.id,
      jeton: genererJetonInscription(),
      statut: StatutInscription.CONFIRMEE,
      source: SourceInscription.MANUEL,
    },
  });

  // Séminaire fermé
  const sFerme = await creerSeminaireOuvert(bleu.id, 'QA — Inscriptions fermées');
  await prisma.seminaire.update({ where: { id: sFerme.id }, data: { inscriptionOuverte: false } });

  // Inscription ANNULEE pour tester /p/{jeton}
  const pAnnule = await prisma.participant.create({
    data: { cabinetId: bleu.id, nom: 'Annule', prenom: 'Test', email: 'qa.annule@example.test' },
  });
  const jetonAnnule = genererJetonInscription();
  await prisma.inscription.create({
    data: {
      seminaireId: sBleu.id,
      participantId: pAnnule.id,
      jeton: jetonAnnule,
      statut: StatutInscription.ANNULEE,
      source: SourceInscription.MANUEL,
    },
  });

  // ------------------------------------------------------------------
  // Séminaire terminé (phase APRES) avec questionnaire publié — pour le
  // parcours de réponse sans JavaScript (lot 3). Un modèle bibliothèque
  // dédié, copié une fois vers ce séminaire (comme le fera le futur espace
  // organisateur), avec un jeton jamais répondu et un second déjà répondu.
  // ------------------------------------------------------------------
  const cabinetQuestionnaire = await prisma.cabinet.create({
    data: { nom: 'Cabinet QA Questionnaire', couleurPrimaire: '#2D5DA8' },
  });
  const seminaireTermine = await prisma.seminaire.create({
    data: {
      cabinetId: cabinetQuestionnaire.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'QA — Séminaire terminé (questionnaire)',
      dateDebut: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      dateFin: new Date(Date.now() - 29 * 24 * 3600 * 1000),
      lieu: 'Dakar',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.CLOTURE,
      inscriptionOuverte: false,
    },
  });

  const modeleQA = await prisma.questionnaire.create({
    data: { cabinetId: cabinetQuestionnaire.id, estModele: true, nom: 'Modèle QA', titre: 'Évaluation QA' },
  });
  const sectionQA = await prisma.section.create({
    data: { questionnaireId: modeleQA.id, titre: 'Général', ordre: 1 },
  });
  await prisma.question.create({
    data: { sectionId: sectionQA.id, intitule: 'Satisfaction globale', type: TypeQuestion.NOTE_5, obligatoire: true, ordre: 1 },
  });
  await prisma.question.create({
    data: {
      sectionId: sectionQA.id,
      intitule: 'Recommanderiez-vous ce séminaire ?',
      type: TypeQuestion.NPS,
      obligatoire: false,
      ordre: 2,
    },
  });
  await prisma.question.create({
    data: { sectionId: sectionQA.id, intitule: 'Vos remarques libres', type: TypeQuestion.TEXTE_LIBRE, obligatoire: false, ordre: 3 },
  });

  const copieQuestionnaire = await copierModeleVersSeminaire(modeleQA.id, seminaireTermine.id);
  await prisma.questionnaire.update({ where: { id: copieQuestionnaire.id }, data: { statut: StatutQuestionnaire.PUBLIE } });

  const participantQuestionnaire = await prisma.participant.create({
    data: { cabinetId: cabinetQuestionnaire.id, nom: 'Questionnaire', prenom: 'Test', email: 'qa.questionnaire@example.test' },
  });
  const jetonQuestionnaire = genererJetonInscription();
  await prisma.inscription.create({
    data: {
      seminaireId: seminaireTermine.id,
      participantId: participantQuestionnaire.id,
      jeton: jetonQuestionnaire,
      statut: StatutInscription.CONFIRMEE,
      source: SourceInscription.MANUEL,
    },
  });

  // Second participant, même questionnaire : chaque test e2e doit partir
  // d'un jeton jamais utilisé, une soumission consomme aRepondu pour de bon.
  const participantQuestionnaireValidation = await prisma.participant.create({
    data: { cabinetId: cabinetQuestionnaire.id, nom: 'QuestionnaireValidation', prenom: 'Test', email: 'qa.questionnaire.validation@example.test' },
  });
  const jetonQuestionnaireValidation = genererJetonInscription();
  await prisma.inscription.create({
    data: {
      seminaireId: seminaireTermine.id,
      participantId: participantQuestionnaireValidation.id,
      jeton: jetonQuestionnaireValidation,
      statut: StatutInscription.CONFIRMEE,
      source: SourceInscription.MANUEL,
    },
  });

  console.log('--- Codes publics QA ---');
  console.log('Bleu (ouvert, avec programme) :', sBleu.codePublic);
  console.log('Vert (ouvert)                :', sVert.codePublic);
  console.log('Orange (ouvert)              :', sOrange.codePublic);
  console.log('Complet                      :', sComplet.codePublic);
  console.log('Fermé                        :', sFerme.codePublic);
  console.log('Jeton ANNULEE (/p/{jeton})   :', jetonAnnule);
  console.log('Jeton questionnaire (/p/{jeton}, jamais répondu) :', jetonQuestionnaire);
  console.log('Jeton questionnaire validation (/p/{jeton}, jamais répondu) :', jetonQuestionnaireValidation);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
