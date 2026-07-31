// Script jetable pour la vérification navigateur manuelle : crée des
// séminaires avec des dates futures et trois couleurs d'accent distinctes.
// Les séminaires du seed (lot 1) ont tous des dates déjà passées relativement
// à aujourd'hui — inutilisables pour tester le parcours d'inscription ouvert.
import { PrismaClient, Modalite, StatutSeminaire, SourceInscription, StatutInscription } from '@prisma/client';
import { genererCodePublicSeminaire, genererJetonInscription } from '../src/lib/jeton';
import { verifierEnvironnementDev } from '../src/lib/garde-environnement-dev';

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

  console.log('--- Codes publics QA ---');
  console.log('Bleu (ouvert, avec programme) :', sBleu.codePublic);
  console.log('Vert (ouvert)                :', sVert.codePublic);
  console.log('Orange (ouvert)              :', sOrange.codePublic);
  console.log('Complet                      :', sComplet.codePublic);
  console.log('Fermé                        :', sFerme.codePublic);
  console.log('Jeton ANNULEE (/p/{jeton})   :', jetonAnnule);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
