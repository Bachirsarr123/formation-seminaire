import argon2 from 'argon2';
import { z } from 'zod';
import { RoleUtilisateur } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { normaliserEmail, normaliserTelephone } from '../src/lib/normalisation';
import { creerModeleEvaluationParDefaut } from '../src/lib/questionnaire/modele-defaut';

/**
 * Point d'entrée UNIQUE pour amorcer une base de production vide : premier
 * cabinet, premier compte organisateur, modèle de questionnaire par défaut.
 * Distinct de prisma/seed.ts (données de démonstration, qui refuse de
 * tourner en production — voir garde-environnement-dev.ts) : ici, aucune
 * donnée fictive, aucun participant de test, rien qui ne doive être
 * supprimé avant la vraie mise en service.
 *
 * Les variables ci-dessous ne sont nécessaires QUE pour cette exécution
 * unique — contrairement à DATABASE_URL/FORM_SIGNING_SECRET/
 * CONSENTEMENT_HASH_SECRET (.env.example), elles ne sont lues nulle part
 * ailleurs dans l'application et peuvent être retirées de la configuration
 * Render juste après (voir DEPLOIEMENT.md).
 */
try {
  process.loadEnvFile('.env');
} catch {
  // .env absent : on suppose que les variables sont déjà dans l'environnement (Render).
}

const LONGUEUR_MOT_DE_PASSE_MINIMALE = 12; // même plancher que la réinitialisation (voir connexion/reinitialiser/[jeton]/actions.ts)

const schemaVariables = z.object({
  CABINET_NOM: z.string().trim().min(1, 'requis'),
  CABINET_COULEUR_PRIMAIRE: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'doit être une couleur hexadécimale, ex. #0F4C81'),
  CABINET_EMAIL_CONTACT: z.string().trim().email('adresse e-mail invalide'),
  CABINET_TELEPHONE_CONTACT: z.string().trim().min(1, 'requis'),
  ORGANISATEUR_EMAIL: z.string().trim().email('adresse e-mail invalide'),
  ORGANISATEUR_NOM: z.string().trim().min(1, 'requis'),
  ORGANISATEUR_PRENOM: z.string().trim().min(1, 'requis'),
  ORGANISATEUR_MOT_DE_PASSE: z
    .string()
    .min(LONGUEUR_MOT_DE_PASSE_MINIMALE, `doit contenir au moins ${LONGUEUR_MOT_DE_PASSE_MINIMALE} caractères`),
});

function lireVariables(): z.infer<typeof schemaVariables> {
  const resultat = schemaVariables.safeParse(process.env);
  if (!resultat.success) {
    console.error("Refusé : variables d'environnement manquantes ou invalides.");
    for (const probleme of resultat.error.issues) {
      console.error(`  - ${probleme.path.join('.')} : ${probleme.message}`);
    }
    process.exit(1);
  }
  return resultat.data;
}

async function refuserSiDonneesExistantes(): Promise<void> {
  const [nbCabinets, nbUtilisateurs, nbQuestionnaires] = await Promise.all([
    prisma.cabinet.count(),
    prisma.utilisateur.count(),
    prisma.questionnaire.count(),
  ]);

  if (nbCabinets > 0 || nbUtilisateurs > 0 || nbQuestionnaires > 0) {
    console.error(
      'Refusé : la base contient déjà des données (cabinet, utilisateur ou questionnaire).\n' +
        "Ce script n'initialise qu'une base neuve — il ne doit jamais tourner deux fois. " +
        'Si la première tentative a échoué en cours de route, vérifiez et nettoyez manuellement avant de relancer.',
    );
    process.exit(1);
  }
}

async function main() {
  const variables = lireVariables();

  const telephoneContact = normaliserTelephone(variables.CABINET_TELEPHONE_CONTACT);
  if (!telephoneContact) {
    console.error(`Refusé : CABINET_TELEPHONE_CONTACT="${variables.CABINET_TELEPHONE_CONTACT}" n'est pas un numéro valide.`);
    process.exit(1);
  }

  const emailCabinet = normaliserEmail(variables.CABINET_EMAIL_CONTACT)!;
  const emailOrganisateur = normaliserEmail(variables.ORGANISATEUR_EMAIL)!;

  await refuserSiDonneesExistantes();

  // Calculé avant toute écriture : jamais de compte organisateur à moitié
  // créé faute d'un hash qui aurait échoué en cours de route.
  const motDePasseHash = await argon2.hash(variables.ORGANISATEUR_MOT_DE_PASSE);

  const cabinet = await prisma.cabinet.create({
    data: {
      nom: variables.CABINET_NOM,
      couleurPrimaire: variables.CABINET_COULEUR_PRIMAIRE,
      emailContact: emailCabinet,
      telephoneContact: telephoneContact,
    },
  });

  const organisateur = await prisma.utilisateur.create({
    data: {
      cabinetId: cabinet.id,
      email: emailOrganisateur,
      nom: variables.ORGANISATEUR_NOM,
      prenom: variables.ORGANISATEUR_PRENOM,
      role: RoleUtilisateur.ORGANISATEUR,
      motDePasseHash,
    },
  });

  const modele = await creerModeleEvaluationParDefaut(cabinet.id);

  console.log('Initialisation terminée.');
  console.log(`- Cabinet : ${cabinet.nom} (${cabinet.id})`);
  console.log(`- Organisateur : ${organisateur.prenom} ${organisateur.nom} <${organisateur.email}>`);
  console.log(`- Modèle de questionnaire par défaut : ${modele.titre}`);
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
