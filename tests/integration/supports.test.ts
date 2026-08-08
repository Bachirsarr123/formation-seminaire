import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import {
  PLAFOND_TAILLE_SUPPORT_OCTETS,
  ajouterSupport,
  basculerVisibiliteSupport,
  deplacerSupport,
  listerSupports,
  obtenirFichierSupportOrganisateur,
  supprimerSupportLogiquement,
} from '../../src/lib/organisateur/supports';
import { listerSupportsVisibles, obtenirFichierSupportVisible } from '../../src/lib/supports-participant';
import { genererCodePublicSeminaire } from '../../src/lib/jeton';

async function creerSeminaire(cabinetId?: string) {
  const cabinet = cabinetId ? { id: cabinetId } : await prisma.cabinet.create({ data: { nom: 'Cabinet test supports' } });

  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire supports',
      dateDebut: new Date('2026-10-01'),
      dateFin: new Date('2026-10-01'),
      modalite: Modalite.PRESENTIEL,
      dureeHeures: 7,
      statut: StatutSeminaire.EN_COURS,
    },
  });

  return { cabinet, seminaire };
}

describe('Supports de cours', () => {
  it('un PDF téléversé apparaît dans la liste organisateur ET dans la liste participant (visible par défaut)', async () => {
    const { cabinet, seminaire } = await creerSeminaire();

    const resultat = await ajouterSupport(cabinet.id, seminaire.id, {
      titre: 'Diaporama introductif',
      nomFichier: 'diaporama.pdf',
      typeMime: 'application/pdf',
      contenu: Buffer.from('%PDF-1.4 contenu de test'),
    });
    expect(resultat.ok).toBe(true);

    const listeOrganisateur = await listerSupports(cabinet.id, seminaire.id);
    expect(listeOrganisateur).toHaveLength(1);
    expect(listeOrganisateur![0]!.titre).toBe('Diaporama introductif');
    expect(listeOrganisateur![0]!.visibleParticipants).toBe(true);

    const listeParticipant = await listerSupportsVisibles(seminaire.id);
    expect(listeParticipant).toHaveLength(1);
    expect(listeParticipant[0]!.titre).toBe('Diaporama introductif');
  });

  it('un support marqué non visible est absent de la liste participant mais reste visible côté organisateur', async () => {
    const { cabinet, seminaire } = await creerSeminaire();

    await ajouterSupport(cabinet.id, seminaire.id, {
      titre: 'Document interne',
      nomFichier: 'interne.pdf',
      typeMime: 'application/pdf',
      contenu: Buffer.from('contenu'),
    });
    const [support] = (await listerSupports(cabinet.id, seminaire.id))!;

    const bascule = await basculerVisibiliteSupport(cabinet.id, seminaire.id, support!.id, false);
    expect(bascule).toBe(true);

    expect(await listerSupportsVisibles(seminaire.id)).toEqual([]);
    const listeOrganisateur = await listerSupports(cabinet.id, seminaire.id);
    expect(listeOrganisateur).toHaveLength(1);
    expect(listeOrganisateur![0]!.visibleParticipants).toBe(false);

    // Le fichier n'est pas non plus téléchargeable côté participant, même
    // en connaissant l'id exact.
    expect(await obtenirFichierSupportVisible(seminaire.id, support!.id)).toBeNull();
  });

  it('un fichier de plus de 10 Mo est refusé avec un message clair, sans ligne créée', async () => {
    const { cabinet, seminaire } = await creerSeminaire();

    const tropGros = Buffer.alloc(PLAFOND_TAILLE_SUPPORT_OCTETS + 1);
    const resultat = await ajouterSupport(cabinet.id, seminaire.id, {
      titre: 'Trop gros',
      nomFichier: 'gros.pdf',
      typeMime: 'application/pdf',
      contenu: tropGros,
    });

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.erreur).toMatch(/10 Mo/);
    }
    expect(await listerSupports(cabinet.id, seminaire.id)).toEqual([]);
  });

  it('un type de fichier non autorisé est refusé', async () => {
    const { cabinet, seminaire } = await creerSeminaire();

    const resultat = await ajouterSupport(cabinet.id, seminaire.id, {
      titre: 'Exécutable',
      nomFichier: 'programme.exe',
      typeMime: 'application/x-msdownload',
      contenu: Buffer.from('MZ'),
    });

    expect(resultat.ok).toBe(false);
    expect(await listerSupports(cabinet.id, seminaire.id)).toEqual([]);
  });

  it('le téléchargement organisateur restitue exactement le contenu et le nom du fichier téléversés', async () => {
    const { cabinet, seminaire } = await creerSeminaire();
    const contenuOriginal = Buffer.from('contenu binaire de test avec des accents éàç');

    await ajouterSupport(cabinet.id, seminaire.id, {
      titre: 'Support',
      nomFichier: 'guide-pratique.pdf',
      typeMime: 'application/pdf',
      contenu: contenuOriginal,
    });
    const [support] = (await listerSupports(cabinet.id, seminaire.id))!;

    const fichier = await obtenirFichierSupportOrganisateur(cabinet.id, seminaire.id, support!.id);
    expect(fichier).not.toBeNull();
    expect(fichier!.nomFichier).toBe('guide-pratique.pdf');
    expect(fichier!.typeMime).toBe('application/pdf');
    expect(Buffer.compare(fichier!.contenu, contenuOriginal)).toBe(0);
  });

  it('isolation par cabinet : aucune opération ne réussit avec un cabinetId étranger', async () => {
    const { cabinet, seminaire } = await creerSeminaire();
    await ajouterSupport(cabinet.id, seminaire.id, {
      titre: 'Support',
      nomFichier: 'doc.pdf',
      typeMime: 'application/pdf',
      contenu: Buffer.from('contenu'),
    });
    const [support] = (await listerSupports(cabinet.id, seminaire.id))!;

    const autreCabinet = await prisma.cabinet.create({ data: { nom: 'Autre cabinet' } });

    expect(await listerSupports(autreCabinet.id, seminaire.id)).toBeNull();
    expect(await obtenirFichierSupportOrganisateur(autreCabinet.id, seminaire.id, support!.id)).toBeNull();
    expect(await basculerVisibiliteSupport(autreCabinet.id, seminaire.id, support!.id, false)).toBe(false);
    expect(await supprimerSupportLogiquement(autreCabinet.id, seminaire.id, support!.id)).toBe(false);

    const resultatAjout = await ajouterSupport(autreCabinet.id, seminaire.id, {
      titre: 'Intrusion',
      nomFichier: 'x.pdf',
      typeMime: 'application/pdf',
      contenu: Buffer.from('x'),
    });
    expect(resultatAjout.ok).toBe(false);

    // Le support original n'a pas bougé.
    const listeInchangee = await listerSupports(cabinet.id, seminaire.id);
    expect(listeInchangee).toHaveLength(1);
    expect(listeInchangee![0]!.visibleParticipants).toBe(true);
  });

  it('la suppression est logique : la ligne reste en base, mais disparaît des deux listes', async () => {
    const { cabinet, seminaire } = await creerSeminaire();
    await ajouterSupport(cabinet.id, seminaire.id, {
      titre: 'À supprimer',
      nomFichier: 'a-supprimer.pdf',
      typeMime: 'application/pdf',
      contenu: Buffer.from('contenu'),
    });
    const [support] = (await listerSupports(cabinet.id, seminaire.id))!;

    expect(await supprimerSupportLogiquement(cabinet.id, seminaire.id, support!.id)).toBe(true);

    expect(await listerSupports(cabinet.id, seminaire.id)).toEqual([]);
    expect(await listerSupportsVisibles(seminaire.id)).toEqual([]);

    const ligneEnBase = await prisma.supportCours.findUnique({ where: { id: support!.id } });
    expect(ligneEnBase).not.toBeNull();
    expect(ligneEnBase!.supprimeLe).not.toBeNull();
  });

  it('la réorganisation échange l\'ordre avec le voisin immédiat', async () => {
    const { cabinet, seminaire } = await creerSeminaire();
    for (const titre of ['Premier', 'Deuxième', 'Troisième']) {
      await ajouterSupport(cabinet.id, seminaire.id, {
        titre,
        nomFichier: `${titre}.pdf`,
        typeMime: 'application/pdf',
        contenu: Buffer.from('contenu'),
      });
    }
    const [premier, deuxieme] = (await listerSupports(cabinet.id, seminaire.id))!;

    await deplacerSupport(cabinet.id, seminaire.id, deuxieme!.id, 'HAUT');

    const apres = await listerSupports(cabinet.id, seminaire.id);
    expect(apres!.map((s) => s.titre)).toEqual(['Deuxième', 'Premier', 'Troisième']);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
