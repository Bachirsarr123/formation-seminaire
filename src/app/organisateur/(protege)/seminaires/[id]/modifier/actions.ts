'use server';

import { redirect } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireSeminaire } from '@/lib/organisateur/formulaire-seminaire';
import { CapaciteInferieureAuxInscritsError, FormateurEtrangerError, modifierSeminaire } from '@/lib/organisateur/seminaires';
import { enregistrerLogoClient, erreurLogoClientInvalide } from '@/lib/organisateur/logo-client';
import type { EtatFormulaireSeminaire } from '@/components/organisateur/formulaire-seminaire';

export async function modifierSeminaireAction(
  seminaireId: string,
  _etatPrecedent: EtatFormulaireSeminaire,
  formData: FormData,
): Promise<EtatFormulaireSeminaire> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireSeminaire(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  // Sans nouveau fichier, le logo existant reste inchangé (pas touché par
  // modifierSeminaire, qui ne connaît pas logoClientUrl).
  const logoClient = formData.get('logoClient');
  const logoFourni = logoClient instanceof File && logoClient.size > 0;
  if (logoFourni) {
    const erreurLogo = erreurLogoClientInvalide(logoClient.type, logoClient.size);
    if (erreurLogo) return { erreur: erreurLogo };
  }

  try {
    const resultat = await modifierSeminaire(contexte.cabinetId, seminaireId, donnees);
    if (!resultat) return { erreur: 'Séminaire introuvable.' };
  } catch (e) {
    if (e instanceof CapaciteInferieureAuxInscritsError || e instanceof FormateurEtrangerError) {
      return { erreur: e.message };
    }
    throw e;
  }

  if (logoFourni) {
    const contenu = Buffer.from(await (logoClient as File).arrayBuffer());
    await enregistrerLogoClient(seminaireId, (logoClient as File).name, contenu);
  }

  redirect(`/organisateur/seminaires/${seminaireId}`);
}
