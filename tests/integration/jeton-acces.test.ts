import { afterAll, describe, expect, it } from 'vitest';
import { Modalite, SourceInscription, StatutInscription, StatutSeminaire } from '@prisma/client';
import { prisma } from '../../src/lib/prisma';
import { resoudreContexteParticipant } from '../../src/lib/contexte-participant';
import { genererCodePublicSeminaire, genererJetonInscription } from '../../src/lib/jeton';

async function creerSeminaireEtParticipant() {
  const cabinet = await prisma.cabinet.create({ data: { nom: 'Cabinet test accès' } });

  const seminaire = await prisma.seminaire.create({
    data: {
      cabinetId: cabinet.id,
      codePublic: genererCodePublicSeminaire(),
      titre: 'Séminaire accès',
      dateDebut: new Date('2026-10-01'),
      dateFin: new Date('2026-10-01'),
      modalite: Modalite.DISTANCIEL,
      dureeHeures: 3,
      statut: StatutSeminaire.PUBLIE,
    },
  });

  const participant = await prisma.participant.create({
    data: { cabinetId: cabinet.id, nom: 'Martin', prenom: 'Sophie', telephone: '+33600000000' },
  });

  return { seminaire, participant };
}

describe('Accès par jeton (AC2, AC3)', () => {
  it('un jeton valide résout un contexte participant, sans étape de connexion', async () => {
    const { seminaire, participant } = await creerSeminaireEtParticipant();
    const jeton = genererJetonInscription();
    await prisma.inscription.create({
      data: {
        seminaireId: seminaire.id,
        participantId: participant.id,
        jeton,
        statut: StatutInscription.CONFIRMEE,
        source: SourceInscription.MANUEL,
      },
    });

    const contexte = await resoudreContexteParticipant(jeton);

    expect(contexte).not.toBeNull();
    expect(contexte?.participant.id).toBe(participant.id);
    expect(contexte?.seminaire.id).toBe(seminaire.id);
  });

  it('un jeton inconnu ne résout aucun contexte (le layout renverra 404, jamais 401/403)', async () => {
    const contexte = await resoudreContexteParticipant('jeton-qui-n-existe-pas-du-tout');

    expect(contexte).toBeNull();
  });

  it('un jeton dont l\'inscription est ANNULEE résout tout de même un contexte (changement assumé du lot 2 : AC3 révisé)', async () => {
    // Le 404 reste réservé aux jetons inconnus ou expirés — pas aux
    // inscriptions annulées. /p/{jeton} doit pouvoir poser le cookie et
    // rediriger vers /mon-espace, qui affiche l'état annulé et un bouton
    // « Me réinscrire » plutôt qu'une page introuvable.
    const { seminaire, participant } = await creerSeminaireEtParticipant();
    const jeton = genererJetonInscription();
    await prisma.inscription.create({
      data: {
        seminaireId: seminaire.id,
        participantId: participant.id,
        jeton,
        statut: StatutInscription.ANNULEE,
        source: SourceInscription.MANUEL,
      },
    });

    const contexte = await resoudreContexteParticipant(jeton);

    expect(contexte).not.toBeNull();
    expect(contexte?.inscription.statut).toBe('ANNULEE');
  });

  it('un jeton expiré ne résout aucun contexte', async () => {
    const { seminaire, participant } = await creerSeminaireEtParticipant();
    const jeton = genererJetonInscription();
    await prisma.inscription.create({
      data: {
        seminaireId: seminaire.id,
        participantId: participant.id,
        jeton,
        statut: StatutInscription.CONFIRMEE,
        source: SourceInscription.MANUEL,
        jetonExpireLe: new Date('2020-01-01'),
      },
    });

    expect(await resoudreContexteParticipant(jeton)).toBeNull();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
