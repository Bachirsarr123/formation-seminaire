'use server';

import { redirect } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { obtenirSeminaire } from '@/lib/organisateur/seminaires';
import { copierModeleVersSeminaire } from '@/lib/questionnaire/copier-modele';

// copierModeleVersSeminaire (lib/questionnaire/copier-modele.ts) vérifie déjà
// que le modèle et le séminaire CIBLES partagent le même cabinet, mais ne
// connaît pas l'identité de l'appelant — sans ce contrôle ici, un
// organisateur du cabinet A pourrait rattacher un modèle au séminaire d'un
// cabinet B en devinant une paire d'id valides pour B. Vérifier que le
// séminaire appartient bien à contexte.cabinetId AVANT l'appel suffit : le
// contrôle interne à copierModeleVersSeminaire garantit alors par
// transitivité que le modèle appartient aussi à ce cabinet.
export async function choisirModeleAction(seminaireId: string, modeleId: string): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const seminaire = await obtenirSeminaire(contexte.cabinetId, seminaireId);
  if (!seminaire) throw new Error('Séminaire introuvable.');

  const copie = await copierModeleVersSeminaire(modeleId, seminaireId);
  redirect(`/organisateur/questionnaires/${copie.id}`);
}
