'use server';

import { revalidatePath } from 'next/cache';
import type { TypeNotation } from '@prisma/client';
import { resoudreContexteLienFormateur } from '@/lib/formateur-lien';
import { enregistrerNotation, lireValeurNotation, TYPES_NOTATION_VALIDES } from '@/lib/organisateur/notations';
import type { EtatNotation } from '@/components/formulaire-notation';

// Même action que l'espace organisateur (notations/actions.ts), mais
// l'accès est vérifié par le code de l'URL plutôt qu'une session — voir
// lib/formateur-lien.ts. Un code invalide/périmé donne le même message
// générique qu'un séminaire introuvable, jamais un indice différent.
export async function enregistrerNotationFormateurAction(
  codeFormateur: string,
  inscriptionId: string,
  _etatPrecedent: EtatNotation,
  formData: FormData,
): Promise<EtatNotation> {
  const contexte = await resoudreContexteLienFormateur(codeFormateur);
  if (!contexte) return { erreur: 'Ce lien n\'est pas valide.' };

  const typeBrut = String(formData.get('typeNotation') ?? '');
  if (!TYPES_NOTATION_VALIDES.includes(typeBrut as TypeNotation)) return { erreur: 'Type de notation invalide.' };

  const resultat = await enregistrerNotation(
    contexte.cabinetId,
    contexte.seminaire.id,
    inscriptionId,
    { utilisateurId: contexte.utilisateurId, cabinetId: contexte.cabinetId, role: 'FORMATEUR' },
    {
      typeNotation: typeBrut as TypeNotation,
      valeur: lireValeurNotation(formData, 'valeur'),
      bareme: lireValeurNotation(formData, 'bareme'),
      justification: String(formData.get('justification') ?? ''),
    },
  );

  if (!resultat.ok) return { erreur: resultat.erreur };

  revalidatePath(`/f/${codeFormateur}/notations`);
  return {};
}
