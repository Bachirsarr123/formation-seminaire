'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { chargerRecueilPublic, soumettreReponseRecueil } from '@/lib/recueil/public';
import { analyserReponsesRecueil } from '@/lib/recueil/validation-reponses';
import { NOM_CHAMP_HONEYPOT, avecIdempotence, estHoneypotRempli, verifierDelaiFormulaire, verifierLimiteIP } from '@/lib/anti-spam';
import type { EtatFormulaireRecueil, ValeursFormulaireRecueil } from './types';

const schemaCoordonnees = z.object({
  prenom: z.string().trim().min(1, 'Merci de renseigner votre prénom.'),
  nom: z.string().trim().min(1, 'Merci de renseigner votre nom.'),
  fonction: z.string().trim(),
  organisation: z.string().trim(),
});

function lireValeurs(formData: FormData): ValeursFormulaireRecueil {
  return {
    prenom: String(formData.get('prenom') ?? ''),
    nom: String(formData.get('nom') ?? ''),
    fonction: String(formData.get('fonction') ?? ''),
    organisation: String(formData.get('organisation') ?? ''),
  };
}

export async function envoyerReponseRecueilAction(
  codeAcces: string,
  _etatPrecedent: EtatFormulaireRecueil,
  formData: FormData,
): Promise<EtatFormulaireRecueil> {
  const valeurs = lireValeurs(formData);

  // Honeypot : silencieux, ne révèle rien à qui (ou ce qui) l'a rempli.
  if (estHoneypotRempli(String(formData.get(NOM_CHAMP_HONEYPOT) ?? ''))) {
    return { valeurs };
  }

  const timestamp = String(formData.get('jetonFormulaireTimestamp') ?? '');
  const signature = String(formData.get('jetonFormulaireSignature') ?? '');
  if (!verifierDelaiFormulaire(timestamp, signature)) {
    return { erreurGenerale: 'Votre formulaire a expiré. Veuillez le soumettre à nouveau.', valeurs };
  }

  const enTetes = await headers();
  const ip = enTetes.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
  if (!verifierLimiteIP(ip)) {
    return { erreurGenerale: 'Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes.', valeurs };
  }

  const analyse = schemaCoordonnees.safeParse(valeurs);
  if (!analyse.success) {
    const erreursChamps: EtatFormulaireRecueil['erreursChamps'] = {};
    for (const probleme of analyse.error.issues) {
      const champ = probleme.path[0];
      if (typeof champ === 'string') {
        erreursChamps[champ as keyof ValeursFormulaireRecueil] = probleme.message;
      }
    }
    return { erreursChamps, valeurs };
  }

  const recueil = await chargerRecueilPublic(codeAcces);
  if (!recueil) {
    return { erreurGenerale: "Ce formulaire n'est plus disponible.", valeurs };
  }

  const reponses = analyserReponsesRecueil(recueil.questions, formData);
  const cleIdempotence = timestamp && signature ? signature : `${codeAcces}-${ip}-${Date.now()}`;

  await avecIdempotence(cleIdempotence, () =>
    soumettreReponseRecueil({
      recueilId: recueil.id,
      nom: analyse.data.nom,
      prenom: analyse.data.prenom,
      fonction: analyse.data.fonction || null,
      organisation: analyse.data.organisation || null,
      reponses,
    }),
  );

  redirect(`/r/${codeAcces}/merci`);
}
