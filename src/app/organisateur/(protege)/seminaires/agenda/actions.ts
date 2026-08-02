'use server';

import { revalidatePath } from 'next/cache';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { regenererJetonFluxIcs } from '@/lib/organisateur/agenda';

// Rôle vérifié explicitement, pas seulement la session (point de vigilance
// du lot) : le flux ICS expose tous les séminaires du cabinet, un formateur
// (lecture seule, cantonné à ses propres séminaires) ne doit pas pouvoir le
// régénérer — ni même y avoir accès, voir la page qui masque cette section.
export async function regenererJetonFluxIcsAction(): Promise<void> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);
  await regenererJetonFluxIcs(contexte.cabinetId);
  revalidatePath('/organisateur/seminaires/agenda');
}
