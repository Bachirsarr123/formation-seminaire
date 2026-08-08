import 'server-only';
import { prisma } from '../prisma';
import { melangerAleatoirement } from '../anonymat';
import { listerInscriptionsSeminaire } from './participants';
import { obtenirQuestionnaireActifDuSeminaire } from './questionnaires';
import { calculerResultatsQuestionnaire, type ResultatsQuestionnaire } from '../questionnaire/resultats';
import type { ContexteOrganisateur } from './session';

// ============================================================
// Page résultats (lot 5, partie B). Combine DEUX familles de requêtes qui ne
// se joignent JAMAIS entre elles au niveau SQL, exactement la frontière de
// la Règle 2 :
//   - côté identité (Inscription/Participant) : taux de réponse, liste des
//     non-répondants pour la relance — « aRepondu est du côté identité de la
//     cloison, c'est permis » ;
//   - côté anonyme (lib/questionnaire/resultats.ts) : moyennes, distributions,
//     textes libres.
// Le résultat assemblé ici en JS ne contient jamais soumissionId, jamais de
// filtre croisé, jamais l'un des deux ensembles de données recroisé avec
// l'autre au niveau d'un individu.
// ============================================================

export interface NonRepondant {
  participantId: string;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
}

export interface ComparaisonModele {
  moyenneSeminaire: number;
  moyennePrecedents: number;
  nbSeminairesPrecedents: number;
}

export interface VueResultats {
  seminaireTitre: string;
  seuilAnonymat: number;
  inscrits: number;
  repondants: number;
  questionnaireId: string | null;
  visible: boolean;
  totalSoumissions: number;
  resultats: ResultatsQuestionnaire | null;
  comparaison: ComparaisonModele | null;
  nonRepondants: NonRepondant[];
}

/**
 * Un formateur ne voit que ses propres séminaires (contrainte de ce lot,
 * plus stricte que le reste de l'espace organisateur qui autorise déjà la
 * lecture inter-séminaires pour un formateur) — vérifié via
 * SeminaireFormateur, jamais déduit d'autre chose.
 */
async function verifierAccesSeminaire(
  cabinetId: string,
  seminaireId: string,
  contexte: ContexteOrganisateur,
): Promise<{ id: string; titre: string; seuilAnonymat: number; dateDebut: Date } | null> {
  const seminaire = await prisma.seminaire.findFirst({
    where: { id: seminaireId, cabinetId, supprimeLe: null },
    select: { id: true, titre: true, seuilAnonymat: true, dateDebut: true },
  });
  if (!seminaire) return null;

  if (contexte.role === 'FORMATEUR') {
    const affecte = await prisma.seminaireFormateur.findFirst({
      where: { seminaireId, utilisateurId: contexte.utilisateurId },
      select: { seminaireId: true },
    });
    if (!affecte) return null;
  }

  return seminaire;
}

/**
 * Compare la moyenne globale de ce séminaire à celle des séminaires
 * PRÉCÉDENTS du cabinet (date de début antérieure) dont le questionnaire
 * descend du même modèle. Chaque séminaire précédent n'entre dans la
 * comparaison que s'il a lui-même atteint son propre seuil d'anonymat —
 * sinon, l'inclure reviendrait à faire fuiter indirectement le résultat
 * d'un tout petit groupe via une moyenne agrégée. En dessous de deux
 * séminaires précédents éligibles, pas de comparaison : un écart contre un
 * seul point de repère ressemble à une tendance alors que ce n'est que du
 * bruit.
 */
async function calculerComparaisonModele(
  cabinetId: string,
  questionnaireActuelId: string,
  modeleOrigineId: string | null,
  dateDebutSeminaireActuel: Date,
  moyenneGlobaleActuelle: number | null,
): Promise<ComparaisonModele | null> {
  if (!modeleOrigineId || moyenneGlobaleActuelle === null) return null;

  const precedents = await prisma.questionnaire.findMany({
    where: {
      cabinetId,
      modeleOrigineId,
      estModele: false,
      supprimeLe: null,
      id: { not: questionnaireActuelId },
      seminaire: { dateDebut: { lt: dateDebutSeminaireActuel }, supprimeLe: null },
    },
    select: { id: true, seminaire: { select: { seuilAnonymat: true } } },
  });

  const moyennesPrecedentes: number[] = [];
  for (const precedent of precedents) {
    const seuil = precedent.seminaire?.seuilAnonymat ?? 5;
    const total = await prisma.soumission.count({ where: { questionnaireId: precedent.id } });
    if (total < seuil) continue;

    const resultatsPrecedents = await calculerResultatsQuestionnaire(precedent.id);
    if (resultatsPrecedents.moyenneGlobale !== null) moyennesPrecedentes.push(resultatsPrecedents.moyenneGlobale);
  }

  if (moyennesPrecedentes.length < 2) return null;

  return {
    moyenneSeminaire: moyenneGlobaleActuelle,
    moyennePrecedents: moyennesPrecedentes.reduce((a, b) => a + b, 0) / moyennesPrecedentes.length,
    nbSeminairesPrecedents: moyennesPrecedentes.length,
  };
}

export async function obtenirResultatsSeminaire(
  cabinetId: string,
  seminaireId: string,
  contexte: ContexteOrganisateur,
): Promise<VueResultats | null> {
  const seminaire = await verifierAccesSeminaire(cabinetId, seminaireId, contexte);
  if (!seminaire) return null;

  const inscriptions = await listerInscriptionsSeminaire(cabinetId, seminaireId, 'CONFIRMEE');
  const inscrits = inscriptions?.length ?? 0;
  const repondants = inscriptions?.filter((i) => i.aRepondu).length ?? 0;
  const nonRepondants: NonRepondant[] = (inscriptions ?? [])
    .filter((i) => !i.aRepondu)
    .map((i) => ({
      participantId: i.participant.id,
      nom: i.participant.nom,
      prenom: i.participant.prenom,
      email: i.participant.email,
      telephone: i.participant.telephone,
    }));

  const base = { seminaireTitre: seminaire.titre, seuilAnonymat: seminaire.seuilAnonymat, inscrits, repondants, nonRepondants };

  const questionnaire = await obtenirQuestionnaireActifDuSeminaire(cabinetId, seminaireId);
  if (!questionnaire) {
    return { ...base, questionnaireId: null, visible: false, totalSoumissions: 0, resultats: null, comparaison: null };
  }

  const totalSoumissions = await prisma.soumission.count({ where: { questionnaireId: questionnaire.id } });
  const visible = totalSoumissions >= seminaire.seuilAnonymat;

  if (!visible) {
    return { ...base, questionnaireId: questionnaire.id, visible: false, totalSoumissions, resultats: null, comparaison: null };
  }

  const resultats = await calculerResultatsQuestionnaire(questionnaire.id);
  const { modeleOrigineId } = await prisma.questionnaire.findUniqueOrThrow({
    where: { id: questionnaire.id },
    select: { modeleOrigineId: true },
  });
  const comparaison = await calculerComparaisonModele(
    cabinetId,
    questionnaire.id,
    modeleOrigineId,
    seminaire.dateDebut,
    resultats.moyenneGlobale,
  );

  return { ...base, questionnaireId: questionnaire.id, visible: true, totalSoumissions, resultats, comparaison };
}

/**
 * Renvoie `null` si le séminaire est introuvable/hors cabinet/hors périmètre
 * formateur, ou si le seuil d'anonymat n'est pas atteint — même garde que
 * l'écran, pour qu'aucun export ne contourne ce que la page refuse déjà
 * d'afficher.
 */
async function questionnaireExportable(
  cabinetId: string,
  seminaireId: string,
  contexte: ContexteOrganisateur,
): Promise<{ questionnaireId: string } | null> {
  const seminaire = await verifierAccesSeminaire(cabinetId, seminaireId, contexte);
  if (!seminaire) return null;

  const questionnaire = await obtenirQuestionnaireActifDuSeminaire(cabinetId, seminaireId);
  if (!questionnaire) return null;

  const total = await prisma.soumission.count({ where: { questionnaireId: questionnaire.id } });
  if (total < seminaire.seuilAnonymat) return null;

  return { questionnaireId: questionnaire.id };
}

function champCsv(valeur: string): string {
  if (/[;"\n\r]/.test(valeur)) return `"${valeur.replace(/"/g, '""')}"`;
  return valeur;
}

const BOM = String.fromCharCode(0xfeff);

/**
 * Résultats agrégés : une ligne par question (moyenne, sans-opinion, nombre
 * de réponses) — la distribution détaillée reste réservée à l'écran, pas à
 * ce fichier qui peut circuler hors de l'application. Aucune colonne
 * organisation/fonction/date : ce sont des agrégats par question, jamais par
 * répondant.
 */
export async function genererCsvResultatsAgreges(
  cabinetId: string,
  seminaireId: string,
  contexte: ContexteOrganisateur,
): Promise<string | null> {
  const acces = await questionnaireExportable(cabinetId, seminaireId, contexte);
  if (!acces) return null;

  const resultats = await calculerResultatsQuestionnaire(acces.questionnaireId);

  const lignes = [['Question', 'Type', 'Moyenne', 'Sans opinion', 'Nombre de réponses'].join(';')];
  for (const q of resultats.questionsFermees) {
    lignes.push(
      [q.intitule, q.type, q.moyenne !== null ? q.moyenne.toFixed(2) : '', String(q.sansOpinion), String(q.nbReponses)]
        .map(champCsv)
        .join(';'),
    );
  }
  for (const q of resultats.questionsOuvertes) {
    lignes.push([q.intitule, 'TEXTE_LIBRE', '', '', String(q.total)].map(champCsv).join(';'));
  }

  return BOM + lignes.join('\r\n') + '\r\n';
}

/**
 * Réponses brutes anonymisées : une ligne par soumission, une colonne par
 * question. `soumissionId` sert UNIQUEMENT de clé de regroupement en
 * mémoire pour reconstituer chaque ligne (une personne a répondu à
 * plusieurs questions) — il n'apparaît jamais dans une colonne, ni ailleurs
 * dans la sortie. Aucune colonne date, lignes mélangées : l'ordre de sortie
 * ne doit pas trahir l'ordre d'arrivée des réponses.
 */
export async function genererCsvReponsesBrutes(
  cabinetId: string,
  seminaireId: string,
  contexte: ContexteOrganisateur,
): Promise<string | null> {
  const acces = await questionnaireExportable(cabinetId, seminaireId, contexte);
  if (!acces) return null;

  const questionnaire = await prisma.questionnaire.findUniqueOrThrow({
    where: { id: acces.questionnaireId },
    select: {
      sections: {
        orderBy: { ordre: 'asc' },
        select: { questions: { where: { supprimeLe: null }, orderBy: { ordre: 'asc' }, select: { id: true, intitule: true, type: true, options: true } } },
      },
    },
  });
  const questions = questionnaire.sections.flatMap((s) => s.questions);

  const soumissions = await prisma.soumission.findMany({
    where: { questionnaireId: acces.questionnaireId },
    select: { reponses: { select: { questionId: true, valeurNumerique: true, valeurTexte: true, valeurOptions: true } } },
  });

  const lignes = [questions.map((q) => champCsv(q.intitule)).join(';')];
  const rangeesBrutes = soumissions.map((soumission) => {
    const parQuestion = new Map(soumission.reponses.map((r) => [r.questionId, r]));
    return questions
      .map((q) => {
        const r = parQuestion.get(q.id);
        if (!r) return '';
        if (q.type === 'TEXTE_LIBRE') return r.valeurTexte ?? '';
        if (q.type === 'QCM_UNIQUE' || q.type === 'QCM_MULTIPLE') {
          const valeurOptions = r.valeurOptions as { choix?: unknown } | null;
          const ids = Array.isArray(valeurOptions?.choix) ? (valeurOptions!.choix as string[]) : [];
          const optionsChoix = (q.options as { choix?: { id: string; libelle: string }[] } | null)?.choix ?? [];
          return ids.map((id) => optionsChoix.find((c) => c.id === id)?.libelle ?? id).join(' / ');
        }
        if (r.valeurNumerique === null) return '';
        if (q.type === 'OUI_NON') return r.valeurNumerique === 1 ? 'Oui' : 'Non';
        return String(r.valeurNumerique);
      })
      .map(champCsv)
      .join(';');
  });

  for (const ligne of melangerAleatoirement(rangeesBrutes)) lignes.push(ligne);

  return BOM + lignes.join('\r\n') + '\r\n';
}
