import 'server-only';
import { Modalite } from '@prisma/client';
import type { DonneesSeminaire, FormateurAffecte, ModuleDonnees } from './seminaires';

export interface ResultatAnalyseFormulaireSeminaire {
  donnees?: DonneesSeminaire;
  erreur?: string;
}

const MODALITES_VALIDES: readonly string[] = Object.values(Modalite);

/**
 * Un seul formulaire, pas d'assistant multi-étapes (lot 4, section E) :
 * toute la validation se fait ici, côté serveur, sur le FormData brut — la
 * seule source de vérité, jamais un état client. Modules et formateurs sont
 * des tableaux parallèles (getAll), pas une notation à crochets : plus
 * simple à produire depuis un formulaire HTML natif.
 */
export function analyserFormulaireSeminaire(formData: FormData): ResultatAnalyseFormulaireSeminaire {
  const titre = String(formData.get('titre') ?? '').trim();
  if (!titre) return { erreur: 'Le titre est obligatoire.' };

  const dateDebut = new Date(String(formData.get('dateDebut') ?? ''));
  const dateFin = new Date(String(formData.get('dateFin') ?? ''));
  if (Number.isNaN(dateDebut.getTime()) || Number.isNaN(dateFin.getTime())) {
    return { erreur: 'Les dates de début et de fin sont obligatoires.' };
  }
  if (dateFin < dateDebut) {
    return { erreur: 'La date de fin doit être postérieure ou égale à la date de début.' };
  }

  const modalite = String(formData.get('modalite') ?? '');
  if (!MODALITES_VALIDES.includes(modalite)) return { erreur: 'Modalité invalide.' };

  const dureeHeures = Number(formData.get('dureeHeures'));
  if (!Number.isFinite(dureeHeures) || dureeHeures <= 0) return { erreur: 'La durée doit être un nombre positif.' };

  const capaciteBrut = String(formData.get('capaciteMax') ?? '').trim();
  const capaciteMax = capaciteBrut === '' ? null : Number(capaciteBrut);
  if (capaciteMax !== null && (!Number.isFinite(capaciteMax) || capaciteMax < 0 || !Number.isInteger(capaciteMax))) {
    return { erreur: 'La capacité doit être un entier positif, ou vide (illimitée).' };
  }

  const seuilBrut = formData.get('seuilAnonymat');
  const seuilAnonymat = seuilBrut === null || seuilBrut === '' ? 5 : Number(seuilBrut);
  if (!Number.isFinite(seuilAnonymat) || seuilAnonymat < 1 || !Number.isInteger(seuilAnonymat)) {
    return { erreur: "Le seuil d'anonymat doit être un entier ≥ 1." };
  }

  const titresModules = formData.getAll('moduleTitre').map(String);
  const dureesModules = formData.getAll('moduleDuree').map(String);
  const modules: ModuleDonnees[] = [];
  for (let i = 0; i < titresModules.length; i++) {
    const t = titresModules[i]!.trim();
    if (!t) continue;
    const d = Number(dureesModules[i] ?? 0);
    modules.push({ titre: t, dureeMinutes: Number.isFinite(d) && d > 0 ? d : 0, ordre: modules.length + 1 });
  }

  const formateurIds = [...new Set(formData.getAll('formateurId').map(String).filter(Boolean))];
  const principalId = String(formData.get('formateurPrincipal') ?? '');
  const formateurs: FormateurAffecte[] = formateurIds.map((id) => ({
    utilisateurId: id,
    roleFormateur: id === principalId ? 'PRINCIPAL' : 'INTERVENANT',
  }));

  return {
    donnees: {
      titre,
      description: String(formData.get('description') ?? '').trim() || null,
      dateDebut,
      dateFin,
      lieu: String(formData.get('lieu') ?? '').trim() || null,
      modalite: modalite as Modalite,
      dureeHeures,
      capaciteMax,
      inscriptionOuverte: formData.get('inscriptionOuverte') === 'on',
      validationRequise: formData.get('validationRequise') === 'on',
      seuilAnonymat,
      formateurs,
      modules,
    },
  };
}
