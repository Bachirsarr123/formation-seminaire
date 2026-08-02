import argon2 from 'argon2';
import {
  Modalite,
  PrismaClient,
  RoleUtilisateur,
  SourceInscription,
  StatutQuestionnaire,
  StatutSeminaire,
  TypeQuestion,
} from '@prisma/client';
import { verifierEnvironnementDev } from '../src/lib/garde-environnement-dev';
import { annulerInscription, inscrireParticipant } from '../src/lib/inscription';
import { genererCodePublicSeminaire } from '../src/lib/jeton';
import { soumettreReponses } from '../src/lib/soumission';
import { copierModeleVersSeminaire } from '../src/lib/questionnaire/copier-modele';

// Contrairement à `prisma migrate reset` (qui charge .env lui-même et le
// transmet à ce script quand il l'invoque comme sous-processus), un lancement
// direct via `npm run seed`/`tsx prisma/seed.ts` ne charge rien : on le fait
// ici. Silencieux si le fichier est absent (CI, où DATABASE_URL est déjà
// injecté par l'environnement).
try {
  process.loadEnvFile('.env');
} catch {
  // .env absent : on suppose que DATABASE_URL est déjà dans l'environnement.
}

// Doit s'exécuter avant tout accès DB : un seed qui recrée des fixtures par
// erreur en production écraserait/mélangerait des données réelles.
verifierEnvironnementDev('seed.ts');

/**
 * Jeu de données volontairement plein de cas limites, pas un jeu "heureux" :
 * c'est en cassant la plateforme sur ces scénarios qu'on découvre les bugs,
 * pas en la testant sur un séminaire de 12 personnes qui répondent toutes.
 */
const prisma = new PrismaClient();

const NOMS = [
  'Diop', 'Ndiaye', 'Fall', 'Gueye', 'Sarr', 'Ba', 'Cisse', 'Diallo', 'Sow', 'Kane',
  'Faye', 'Mbaye', 'Niang', 'Sy', 'Toure', 'Camara', 'Sane', 'Diagne', 'Thiam', 'Dieng',
];
const PRENOMS = [
  'Awa', 'Moussa', 'Fatou', 'Ibrahima', 'Aissatou', 'Ousmane', 'Mariama', 'Cheikh',
  'Khady', 'Abdou', 'Bineta', 'Alioune', 'Coumba', 'Mamadou', 'Ndeye', 'Souleymane',
];

function piocher<T>(liste: T[], index: number): T {
  return liste[index % liste.length]!;
}

// Un modèle est un questionnaire comme les autres (schema.prisma), détaché
// d'un séminaire — pas de tables ModeleQuestionnaire/Section/Question en
// miroir. Un seul modèle dans la bibliothèque du cabinet, copié pour chaque
// séminaire qui a besoin d'un questionnaire (lib/questionnaire/copier-modele.ts).
async function creerModeleEvaluation(cabinetId: string) {
  const modele = await prisma.questionnaire.create({
    data: {
      cabinetId,
      estModele: true,
      nom: 'Évaluation à chaud',
      titre: 'Évaluation à chaud',
      statut: StatutQuestionnaire.BROUILLON,
    },
  });
  const section = await prisma.section.create({
    data: { questionnaireId: modele.id, titre: 'Général', ordre: 1 },
  });
  await prisma.question.create({
    data: {
      sectionId: section.id,
      intitule: 'Satisfaction globale',
      type: TypeQuestion.NOTE_5,
      obligatoire: true,
      ordre: 1,
    },
  });
  await prisma.question.create({
    data: {
      sectionId: section.id,
      intitule: 'Qualité de la restauration',
      type: TypeQuestion.ECHELLE_4,
      obligatoire: false,
      // Une Likert sans intitulé ne veut rien dire pour le répondant.
      options: {
        libelles: {
          '1': 'Pas du tout satisfait·e',
          '2': 'Plutôt pas satisfait·e',
          '3': 'Plutôt satisfait·e',
          '4': 'Tout à fait satisfait·e',
        },
      },
      // Tout le monde n'a pas déjeuné sur place : « sans opinion » évite de
      // forcer un chiffre au hasard qui fausserait silencieusement la moyenne.
      autoriseSansOpinion: true,
      ordre: 2,
    },
  });
  await prisma.question.create({
    data: { sectionId: section.id, intitule: 'Vos remarques libres', type: TypeQuestion.TEXTE_LIBRE, ordre: 3, obligatoire: false },
  });
  return modele;
}

// Copie le modèle vers un séminaire puis republie les questions dans l'ordre
// pour permettre à `soumettreReponses` (utilisé plus bas) de cibler la bonne
// question sans redéclarer sa structure à chaque séminaire.
async function creerQuestionnaireSeminaire(modeleId: string, seminaireId: string) {
  const copie = await copierModeleVersSeminaire(modeleId, seminaireId);
  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { id: copie.id },
    include: { sections: { include: { questions: { orderBy: { ordre: 'asc' } } }, orderBy: { ordre: 'asc' } } },
  });
  const questions = questionnaire.sections[0]!.questions;
  return {
    questionnaire,
    questionSatisfaction: questions[0]!,
    questionRestauration: questions[1]!,
    questionLibre: questions[2]!,
  };
}

async function main() {
  const cabinet = await prisma.cabinet.create({
    data: { nom: 'Cabinet Méridien Formation', couleurPrimaire: '#0F4C81' },
  });

  // Mot de passe de démonstration — identifiants réels pour se connecter à
  // l'espace organisateur (lot 4). Ne jamais utiliser hors développement local.
  const motDePasseHash = await argon2.hash('ChangeMe!2026-demo-seed');

  await prisma.utilisateur.create({
    data: {
      cabinetId: cabinet.id,
      email: 'organisatrice@meridien-formation.test',
      nom: 'Ndiaye',
      prenom: 'Awa',
      role: RoleUtilisateur.ORGANISATEUR,
      motDePasseHash,
    },
  });

  const formateurIssa = await prisma.utilisateur.create({
    data: {
      cabinetId: cabinet.id,
      email: 'formateur@meridien-formation.test',
      nom: 'Camara',
      prenom: 'Issa',
      role: RoleUtilisateur.FORMATEUR,
      motDePasseHash: null, // lien magique, jamais de mot de passe
    },
  });

  // Un seul modèle dans la bibliothèque du cabinet, copié pour chaque
  // séminaire qui a besoin d'un questionnaire (voir creerQuestionnaireSeminaire).
  const modeleEvaluation = await creerModeleEvaluation(cabinet.id);

  // ------------------------------------------------------------------
  // Participant recontacté sur plusieurs séminaires (rattaché au cabinet,
  // pas à un séminaire : historique conservé entre sessions).
  // ------------------------------------------------------------------
  const participantMultiSeminaires = await prisma.participant.create({
    data: {
      cabinetId: cabinet.id,
      nom: 'Sarr',
      prenom: 'Khady',
      email: 'khady.sarr@example.test',
      telephone: '+221771112233',
      fonction: 'Responsable RH',
      organisation: 'ONG Jokko',
    },
  });

  // ==================================================================
  // 1. Séminaire micro-groupe (3 participants) — le seuil d'anonymat
  //    (défaut 5) n'est jamais atteint, même si tout le monde écrit.
  // ==================================================================
  const seminaireMicro = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Atelier restreint — gouvernance associative',
      dateDebut: new Date('2026-03-10T09:00:00Z'),
      dateFin: new Date('2026-03-10T17:00:00Z'),
      lieu: 'Dakar',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.EN_COURS,
      inscriptionOuverte: true,
    },
  });

  const participantEmailSeul = await prisma.participant.create({
    data: { cabinetId: cabinet.id, nom: 'Diop', prenom: 'Moussa', email: 'moussa.diop@example.test' },
  });
  // Sans email, joignable uniquement par téléphone (WhatsApp) — respecte la
  // contrainte CHECK participant_contact_requis (email OU telephone).
  const participantTelephoneSeul = await prisma.participant.create({
    data: { cabinetId: cabinet.id, nom: 'Fall', prenom: 'Ibrahima', email: null, telephone: '+221765554433' },
  });

  await inscrireParticipant({ seminaireId: seminaireMicro.id, participantId: participantEmailSeul.id, source: SourceInscription.MANUEL });
  await inscrireParticipant({ seminaireId: seminaireMicro.id, participantId: participantTelephoneSeul.id, source: SourceInscription.MANUEL });
  // Participant inscrit à 3 séminaires différents (1/3 ici).
  await inscrireParticipant({ seminaireId: seminaireMicro.id, participantId: participantMultiSeminaires.id, source: SourceInscription.MANUEL });

  await prisma.messageAnonyme.create({
    data: { seminaireId: seminaireMicro.id, contenu: "L'ambiance était bonne mais la salle trop petite.", codeSuiviHash: 'hash-micro-1' },
  });
  await prisma.messageAnonyme.create({
    data: { seminaireId: seminaireMicro.id, contenu: 'Merci pour ce format, à refaire.', codeSuiviHash: 'hash-micro-2' },
  });

  // Un formateur ne voit que ses propres séminaires (lot 4) — au moins deux
  // affectations pour que ce filtre soit vérifiable, avec des rôles distincts.
  await prisma.seminaireFormateur.create({
    data: { seminaireId: seminaireMicro.id, utilisateurId: formateurIssa.id, roleFormateur: 'INTERVENANT' },
  });

  // ==================================================================
  // 2. Séminaire grand groupe (40 participants, 12 sans réponse) —
  //    inclut aussi le cycle annulation / ré-inscription avec aRepondu
  //    déjà à true, et des réponses libres limites (très longue,
  //    emojis/accents).
  // ==================================================================
  const seminaireGrand = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire annuel des délégués régionaux',
      dateDebut: new Date('2026-04-14T08:30:00Z'),
      dateFin: new Date('2026-04-15T17:00:00Z'),
      lieu: 'Saly',
      modalite: Modalite.HYBRIDE,
      dureeHeures: 14,
      capaciteMax: 60,
      statut: StatutSeminaire.EN_COURS,
      inscriptionOuverte: true,
    },
  });
  await prisma.seminaireFormateur.create({
    data: { seminaireId: seminaireGrand.id, utilisateurId: formateurIssa.id, roleFormateur: 'PRINCIPAL' },
  });

  const { questionnaire: qGrand, questionSatisfaction: qSatGrand, questionLibre: qLibreGrand } =
    await creerQuestionnaireSeminaire(modeleEvaluation.id, seminaireGrand.id);
  // PUBLIE pose verrouille_le (trigger) ; encore modifiable tant qu'aucune
  // soumission n'existe — verrouillé pour de bon dès la première réponse
  // ci-dessous.
  await prisma.questionnaire.update({ where: { id: qGrand.id }, data: { statut: StatutQuestionnaire.PUBLIE } });

  const texteTresLong =
    "Je tiens à revenir en détail sur l'organisation de ce séminaire, qui a représenté selon moi un vrai tournant dans la façon dont notre réseau régional aborde la formation continue. ".repeat(12) +
    "En résumé : contenu solide, logistique perfectible, à reconduire l'an prochain avec plus de temps pour les ateliers pratiques.";
  const texteEmojisAccents =
    'Très bien organisé 👍😊 — merci à l\'équipe pédagogique ! Café ☕ un peu froid le premier jour, mais sinon parfait 🎉. À réitérer, sans hésiter 🙏.';

  // Le participant qui subit un cycle complet annulation / ré-inscription.
  const participantCycleComplet = await prisma.participant.create({
    data: { cabinetId: cabinet.id, nom: 'Gueye', prenom: 'Fatou', email: 'fatou.gueye@example.test', telephone: '+221701234567' },
  });

  const TOTAL_PARTICIPANTS_GRAND = 40;
  const NB_SANS_REPONSE = 12;
  let indexTexteLong: number | null = null;
  let indexTexteEmoji: number | null = null;

  for (let i = 0; i < TOTAL_PARTICIPANTS_GRAND; i++) {
    let participantId: string;

    if (i === 0) {
      participantId = participantCycleComplet.id;
    } else if (i === 1) {
      participantId = participantMultiSeminaires.id; // 2/3 séminaires pour ce participant
    } else {
      const p = await prisma.participant.create({
        data: {
          cabinetId: cabinet.id,
          nom: piocher(NOMS, i),
          prenom: piocher(PRENOMS, i + 3),
          email: `participant.grand.${i}@example.test`,
          telephone: i % 5 === 0 ? `+22177${(1000000 + i).toString().slice(-7)}` : null,
        },
      });
      participantId = p.id;
    }

    const inscription = await inscrireParticipant({
      seminaireId: seminaireGrand.id,
      participantId,
      source: i % 3 === 0 ? SourceInscription.IMPORT : SourceInscription.MANUEL,
    });

    const aRepondu = i < TOTAL_PARTICIPANTS_GRAND - NB_SANS_REPONSE; // les 12 derniers ne répondent pas
    if (aRepondu) {
      let valeurTexte = `Séminaire utile, contenu ${i % 2 === 0 ? 'bien' : 'très bien'} calibré.`;
      if (indexTexteLong === null && i > 5) {
        valeurTexte = texteTresLong;
        indexTexteLong = i;
      } else if (indexTexteEmoji === null && i > 5) {
        valeurTexte = texteEmojisAccents;
        indexTexteEmoji = i;
      }

      await soumettreReponses({
        jeton: inscription.jeton,
        questionnaireId: qGrand.id,
        reponses: [
          { questionId: qSatGrand.id, valeurNumerique: (i % 5) + 1 },
          { questionId: qLibreGrand.id, valeurTexte },
        ],
      });
    }

    if (participantId === participantCycleComplet.id) {
      // A déjà répondu ; on annule puis on ré-inscrit avec un jeton neuf.
      // aRepondu doit rester à true après le cycle complet (cf. lib/inscription.ts).
      await annulerInscription(inscription.id);
      await inscrireParticipant({
        seminaireId: seminaireGrand.id,
        participantId: participantCycleComplet.id,
        source: SourceInscription.MANUEL,
      });
    }
  }

  // Messages anonymes au-dessus du seuil par défaut (5) : visibles, contrairement au séminaire micro-groupe.
  for (let i = 1; i <= 5; i++) {
    await prisma.messageAnonyme.create({
      data: { seminaireId: seminaireGrand.id, contenu: `Message anonyme ${i} du grand groupe.`, codeSuiviHash: `hash-grand-${i}` },
    });
  }

  // ==================================================================
  // 3. Séminaire complet (capaciteMax atteinte) — inscriptions closes.
  // ==================================================================
  const CAPACITE_COMPLET = 15;
  const seminaireComplet = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Formation certifiante — places limitées',
      dateDebut: new Date('2026-05-05T09:00:00Z'),
      dateFin: new Date('2026-05-06T17:00:00Z'),
      lieu: 'Thiès',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 14,
      capaciteMax: CAPACITE_COMPLET,
      statut: StatutSeminaire.PUBLIE,
      inscriptionOuverte: false, // complet : inscriptions fermées
    },
  });

  for (let i = 0; i < CAPACITE_COMPLET; i++) {
    const participantId =
      i === 0
        ? participantMultiSeminaires.id // 3/3 séminaires pour ce participant
        : (
            await prisma.participant.create({
              data: {
                cabinetId: cabinet.id,
                nom: piocher(NOMS, i + 7),
                prenom: piocher(PRENOMS, i + 1),
                email: `participant.complet.${i}@example.test`,
              },
            })
          ).id;

    await inscrireParticipant({ seminaireId: seminaireComplet.id, participantId, source: SourceInscription.AUTO_INSCRIPTION });
  }

  // ==================================================================
  // 4. Séminaire à validation requise — inscriptions en attente.
  // ==================================================================
  const seminaireValidation = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Formation avancée — sur candidature',
      dateDebut: new Date('2026-06-02T09:00:00Z'),
      dateFin: new Date('2026-06-02T17:00:00Z'),
      lieu: 'Distanciel',
      modalite: Modalite.DISTANCIEL,
      dureeHeures: 6,
      statut: StatutSeminaire.PUBLIE,
      inscriptionOuverte: true,
      validationRequise: true,
    },
  });

  for (let i = 0; i < 6; i++) {
    const participant = await prisma.participant.create({
      data: {
        cabinetId: cabinet.id,
        nom: piocher(NOMS, i + 12),
        prenom: piocher(PRENOMS, i + 8),
        email: `participant.validation.${i}@example.test`,
      },
    });

    // Les 3 premiers attendent encore la validation de l'organisateur ;
    // inscrireParticipant() force CONFIRMEE, donc on écrit directement
    // ces 3-là pour représenter l'état EN_ATTENTE.
    if (i < 3) {
      await prisma.inscription.create({
        data: {
          seminaireId: seminaireValidation.id,
          participantId: participant.id,
          jeton: genererCodePublicSeminaire() + genererCodePublicSeminaire(),
          source: SourceInscription.AUTO_INSCRIPTION,
        },
      });
    } else {
      await inscrireParticipant({ seminaireId: seminaireValidation.id, participantId: participant.id, source: SourceInscription.AUTO_INSCRIPTION });
    }
  }

  // ==================================================================
  // 5. Séminaire clôturé — session passée, déjà évaluée.
  // ==================================================================
  const seminaireCloture = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire clôturé — session de janvier',
      dateDebut: new Date('2026-01-20T09:00:00Z'),
      dateFin: new Date('2026-01-20T17:00:00Z'),
      lieu: 'Saint-Louis',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.CLOTURE,
      inscriptionOuverte: false,
    },
  });
  const { questionnaire: qCloture, questionSatisfaction: qSatCloture, questionLibre: qLibreCloture } =
    await creerQuestionnaireSeminaire(modeleEvaluation.id, seminaireCloture.id);
  await prisma.questionnaire.update({ where: { id: qCloture.id }, data: { statut: StatutQuestionnaire.PUBLIE } });

  for (let i = 0; i < 5; i++) {
    const participant = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: piocher(NOMS, i + 2), prenom: piocher(PRENOMS, i + 5), email: `participant.cloture.${i}@example.test` },
    });
    const inscription = await inscrireParticipant({ seminaireId: seminaireCloture.id, participantId: participant.id, source: SourceInscription.MANUEL });
    await soumettreReponses({
      jeton: inscription.jeton,
      questionnaireId: qCloture.id,
      reponses: [
        { questionId: qSatCloture.id, valeurNumerique: 4 },
        { questionId: qLibreCloture.id, valeurTexte: 'Bonne session, formateur disponible.' },
      ],
    });
  }

  // Le questionnaire ferme après coup — verrouille_le, posé dès la
  // publication ci-dessus, est déjà définitif ; seuls dateLimite et statut
  // restent modifiables après verrouillage.
  await prisma.questionnaire.update({ where: { id: qCloture.id }, data: { statut: StatutQuestionnaire.FERME } });

  // ==================================================================
  // 6. Séminaire archivé — plus ancien, hors du cycle actif.
  // ==================================================================
  const seminaireArchive = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire archivé — édition 2025',
      dateDebut: new Date('2025-09-15T09:00:00Z'),
      dateFin: new Date('2025-09-15T17:00:00Z'),
      lieu: 'Kaolack',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.ARCHIVE,
      inscriptionOuverte: false,
    },
  });

  for (let i = 0; i < 4; i++) {
    const participant = await prisma.participant.create({
      data: { cabinetId: cabinet.id, nom: piocher(NOMS, i + 15), prenom: piocher(PRENOMS, i + 10), email: `participant.archive.${i}@example.test` },
    });
    await inscrireParticipant({ seminaireId: seminaireArchive.id, participantId: participant.id, source: SourceInscription.IMPORT });
  }

  // ==================================================================
  // 7. Second cabinet, entièrement indépendant — sert uniquement à vérifier
  //    l'isolation (lot 4, section B) : un organisateur du Cabinet Méridien
  //    ne doit jamais atteindre quoi que ce soit ici, et réciproquement.
  //    Mêmes identifiants de démonstration pour rester testable simplement.
  // ==================================================================
  const cabinetB = await prisma.cabinet.create({
    data: { nom: 'Cabinet Horizon Conseil', couleurPrimaire: '#7A2E8C' },
  });

  await prisma.utilisateur.create({
    data: {
      cabinetId: cabinetB.id,
      email: 'organisateur@horizon-conseil.test',
      nom: 'Diallo',
      prenom: 'Fatoumata',
      role: RoleUtilisateur.ORGANISATEUR,
      motDePasseHash,
    },
  });

  const participantCabinetB = await prisma.participant.create({
    data: { cabinetId: cabinetB.id, nom: 'Ndao', prenom: 'Cheikh', email: 'cheikh.ndao@example.test' },
  });

  const seminaireCabinetB = await prisma.seminaire.create({
    data: {
      cabinetId: cabinetB.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire du Cabinet Horizon Conseil',
      dateDebut: new Date('2026-05-20T09:00:00Z'),
      dateFin: new Date('2026-05-20T17:00:00Z'),
      lieu: 'Saint-Louis',
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.PUBLIE,
      inscriptionOuverte: true,
    },
  });

  await inscrireParticipant({
    seminaireId: seminaireCabinetB.id,
    participantId: participantCabinetB.id,
    source: SourceInscription.MANUEL,
  });

  console.log('Seed terminé.');
  console.log(`- ${seminaireMicro.titre} (3 participants, seuil d'anonymat jamais atteint)`);
  console.log(`- ${seminaireGrand.titre} (${TOTAL_PARTICIPANTS_GRAND} participants, ${NB_SANS_REPONSE} sans réponse)`);
  console.log(`- ${seminaireComplet.titre} (complet, ${CAPACITE_COMPLET}/${CAPACITE_COMPLET})`);
  console.log(`- ${seminaireValidation.titre} (validation requise, 3 en attente / 3 confirmées)`);
  console.log(`- ${seminaireCloture.titre} (clôturé)`);
  console.log(`- ${seminaireArchive.titre} (archivé)`);
  console.log(`- ${cabinetB.nom} (cabinet indépendant, isolation) : ${seminaireCabinetB.titre}`);
  console.log('Identifiants de démonstration (mot de passe ChangeMe!2026-demo-seed) :');
  console.log('  organisatrice@meridien-formation.test');
  console.log('  organisateur@horizon-conseil.test');
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
