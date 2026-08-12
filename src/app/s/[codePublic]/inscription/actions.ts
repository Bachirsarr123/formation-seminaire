'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { chargerSeminairePublic } from '@/lib/seminaire-public';
import {
  InscriptionsFermeesError,
  SeminaireIndisponibleError,
  SeminaireTermineError,
  traiterInscriptionPublique,
} from '@/lib/inscription-publique';
import { poserCookieSession } from '@/lib/session';
import {
  NOM_CHAMP_HONEYPOT,
  avecIdempotence,
  estHoneypotRempli,
  verifierDelaiFormulaire,
  verifierLimiteIP,
} from '@/lib/anti-spam';
import { envoyerLienInscription } from '@/lib/notification';
import { construireOrigineRequete } from '@/lib/origine-requete';
import type { EtatFormulaireInscription, ValeursFormulaireInscription } from './types';

const schemaInscription = z
  .object({
    prenom: z.string().trim().min(1, 'Merci de renseigner votre prénom.'),
    nom: z.string().trim().min(1, 'Merci de renseigner votre nom.'),
    email: z.string().trim(),
    telephone: z.string().trim(),
    fonction: z.string().trim(),
  })
  .refine((donnees) => donnees.email !== '' || donnees.telephone !== '', {
    message: "Ce numéro n'est pas reconnu. Vérifiez l'indicatif, par exemple +221 77 000 00 00, ou renseignez un e-mail.",
    path: ['telephone'],
  });

function lireValeurs(formData: FormData): ValeursFormulaireInscription {
  return {
    prenom: String(formData.get('prenom') ?? ''),
    nom: String(formData.get('nom') ?? ''),
    email: String(formData.get('email') ?? ''),
    telephone: String(formData.get('telephone') ?? ''),
    fonction: String(formData.get('fonction') ?? ''),
  };
}

export async function inscrireAction(
  codePublic: string,
  _etatPrecedent: EtatFormulaireInscription,
  formData: FormData,
): Promise<EtatFormulaireInscription> {
  const valeurs = lireValeurs(formData);

  // Honeypot : silencieux, ne révèle rien à qui (ou ce qui) l'a rempli.
  if (estHoneypotRempli(String(formData.get(NOM_CHAMP_HONEYPOT) ?? ''))) {
    return { valeurs };
  }

  const timestamp = String(formData.get('jetonFormulaireTimestamp') ?? '');
  const signature = String(formData.get('jetonFormulaireSignature') ?? '');
  if (!verifierDelaiFormulaire(timestamp, signature)) {
    return {
      erreurGenerale: 'Votre formulaire a expiré. Veuillez le soumettre à nouveau.',
      valeurs,
    };
  }

  const enTetes = await headers();
  const ip = enTetes.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
  if (!verifierLimiteIP(ip)) {
    return {
      erreurGenerale: 'Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes.',
      valeurs,
    };
  }

  const analyse = schemaInscription.safeParse(valeurs);
  if (!analyse.success) {
    const erreursChamps: EtatFormulaireInscription['erreursChamps'] = {};
    for (const probleme of analyse.error.issues) {
      const champ = probleme.path[0];
      if (typeof champ === 'string') {
        erreursChamps[champ as keyof ValeursFormulaireInscription] = probleme.message;
      }
    }
    return { erreursChamps, valeurs };
  }

  const resultatSeminaire = await chargerSeminairePublic(codePublic);
  if (!resultatSeminaire) {
    return { erreurGenerale: "Ce séminaire n'existe plus.", valeurs };
  }

  const userAgent = enTetes.get('user-agent') ?? '';
  const cleIdempotence = timestamp && signature ? `${signature}` : `${codePublic}-${ip}-${Date.now()}`;

  let resultat;
  try {
    resultat = await avecIdempotence(cleIdempotence, () =>
      traiterInscriptionPublique({
        seminaireId: resultatSeminaire.seminaire.id,
        nom: analyse.data.nom,
        prenom: analyse.data.prenom,
        email: analyse.data.email || null,
        telephone: analyse.data.telephone || null,
        fonction: analyse.data.fonction || null,
        ip,
        userAgent,
        communicationsCoche: formData.get('communications') !== null,
        partageEmployeurCoche: formData.get('partageEmployeur') !== null,
      }),
    );
  } catch (erreur) {
    if (erreur instanceof InscriptionsFermeesError) {
      return { erreurGenerale: 'Les inscriptions sont fermées pour ce séminaire.', valeurs };
    }
    if (erreur instanceof SeminaireTermineError) return { erreurGenerale: 'Ce séminaire est terminé.', valeurs };
    if (erreur instanceof SeminaireIndisponibleError) {
      return { erreurGenerale: "Ce séminaire n'est plus disponible.", valeurs };
    }
    throw erreur;
  }

  await poserCookieSession(resultat.jeton, resultat.dateFinSeminaire);

  if (resultat.situation !== 'dejaActive') {
    // Transactionnel : découle de l'inscription elle-même, jamais bloqué par
    // un retrait de consentement COMMUNICATIONS (voir lib/notification.ts).
    await envoyerLienInscription(
      {
        participantId: resultat.participantId,
        nom: analyse.data.nom,
        prenom: analyse.data.prenom,
        email: analyse.data.email || null,
        telephone: analyse.data.telephone || null,
      },
      `${construireOrigineRequete(enTetes)}/p/${resultat.jeton}`,
    );
  }

  redirect(`/s/${codePublic}/confirmation?situation=${resultat.situation}`);
}
