'use server';

import { redirect } from 'next/navigation';
import { exigerContexteOrganisateur } from '@/lib/organisateur/session';
import { analyserFormulaireSeminaire } from '@/lib/organisateur/formulaire-seminaire';
import { FormateurEtrangerError, creerSeminaire } from '@/lib/organisateur/seminaires';
import { enregistrerLogoClient, erreurLogoClientInvalide } from '@/lib/organisateur/logo-client';
import type { EtatFormulaireSeminaire } from '@/components/organisateur/formulaire-seminaire';

// Rôle vérifié explicitement (jamais seulement la session) : un formateur
// est en lecture seule, il ne crée jamais de séminaire.
export async function creerSeminaireAction(
  _etatPrecedent: EtatFormulaireSeminaire,
  formData: FormData,
): Promise<EtatFormulaireSeminaire> {
  const contexte = await exigerContexteOrganisateur(['ORGANISATEUR']);

  const { donnees, erreur } = analyserFormulaireSeminaire(formData);
  if (erreur || !donnees) return { erreur: erreur ?? 'Formulaire invalide.' };

  // Validé AVANT la création du séminaire : un logo invalide ne doit pas
  // laisser un séminaire à moitié créé derrière lui.
  const logoClient = formData.get('logoClient');
  const logoFourni = logoClient instanceof File && logoClient.size > 0;
  if (logoFourni) {
    const erreurLogo = erreurLogoClientInvalide(logoClient.type, logoClient.size);
    if (erreurLogo) return { erreur: erreurLogo };
  }

  let seminaire;
  try {
    seminaire = await creerSeminaire(contexte.cabinetId, donnees);
  } catch (e) {
    if (e instanceof FormateurEtrangerError) return { erreur: e.message };
    throw e;
  }

  if (logoFourni) {
    const contenu = Buffer.from(await (logoClient as File).arrayBuffer());
    await enregistrerLogoClient(seminaire.id, (logoClient as File).name, contenu);
  }

  redirect(`/organisateur/seminaires/${seminaire.id}`);
}
