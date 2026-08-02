import { describe, expect, it } from 'vitest';
import { analyserReponsesFormulaire, nomChampQuestion, type QuestionPourValidation } from '../../src/lib/questionnaire/validation-reponses';

function q(partial: Partial<QuestionPourValidation> & { id: string; type: QuestionPourValidation['type'] }): QuestionPourValidation {
  return { obligatoire: false, autoriseSansOpinion: false, options: null, ...partial };
}

function formulaire(entrees: [string, string][]): FormData {
  const fd = new FormData();
  for (const [nom, valeur] of entrees) fd.append(nom, valeur);
  return fd;
}

describe('analyserReponsesFormulaire', () => {
  it('question obligatoire non répondue → erreur, aucune reponse produite', () => {
    const question = q({ id: 'q1', type: 'NOTE_5', obligatoire: true });
    const { reponses, erreurs } = analyserReponsesFormulaire([question], formulaire([]));

    expect(reponses).toEqual([]);
    expect(erreurs).toEqual([{ questionId: 'q1', message: 'Réponse requise.' }]);
  });

  it('valeur hors bornes (POST forgé) → erreur, jamais silencieusement acceptée', () => {
    const question = q({ id: 'q1', type: 'NOTE_5' });
    const { reponses, erreurs } = analyserReponsesFormulaire(
      [question],
      formulaire([[nomChampQuestion('q1'), '99']]),
    );

    expect(reponses).toEqual([]);
    expect(erreurs).toEqual([{ questionId: 'q1', message: 'Réponse invalide.' }]);
  });

  it('« sans opinion » n\'est accepté que si la question l\'autorise', () => {
    const questionAutorisee = q({ id: 'q1', type: 'ECHELLE_4', autoriseSansOpinion: true });
    const resultatOk = analyserReponsesFormulaire(
      [questionAutorisee],
      formulaire([[nomChampQuestion('q1'), 'sans-opinion']]),
    );
    expect(resultatOk.erreurs).toEqual([]);
    expect(resultatOk.reponses).toEqual([{ questionId: 'q1', valeurOptions: { sansOpinion: true } }]);

    const questionInterdite = q({ id: 'q2', type: 'ECHELLE_4', autoriseSansOpinion: false });
    const resultatKo = analyserReponsesFormulaire(
      [questionInterdite],
      formulaire([[nomChampQuestion('q2'), 'sans-opinion']]),
    );
    expect(resultatKo.reponses).toEqual([]);
    expect(resultatKo.erreurs).toEqual([{ questionId: 'q2', message: 'Réponse invalide.' }]);
  });

  it('QCM_MULTIPLE obligatoire : au moins une case cochée requise, plusieurs valeurs acceptées', () => {
    const options = { choix: [{ id: 'a', libelle: 'A' }, { id: 'b', libelle: 'B' }, { id: 'c', libelle: 'C' }] };
    const question = q({ id: 'q1', type: 'QCM_MULTIPLE', obligatoire: true, options });

    const vide = analyserReponsesFormulaire([question], formulaire([]));
    expect(vide.erreurs).toEqual([{ questionId: 'q1', message: 'Réponse requise.' }]);

    const champ = nomChampQuestion('q1');
    const rempli = analyserReponsesFormulaire([question], formulaire([[champ, 'a'], [champ, 'c']]));
    expect(rempli.erreurs).toEqual([]);
    expect(rempli.reponses).toEqual([{ questionId: 'q1', valeurOptions: { choix: ['a', 'c'] } }]);
  });

  it('QCM_UNIQUE : un id hors des options déclarées est rejeté', () => {
    const options = { choix: [{ id: 'a', libelle: 'A' }] };
    const question = q({ id: 'q1', type: 'QCM_UNIQUE', options });
    const { erreurs, reponses } = analyserReponsesFormulaire(
      [question],
      formulaire([[nomChampQuestion('q1'), 'id-invente']]),
    );
    expect(reponses).toEqual([]);
    expect(erreurs).toEqual([{ questionId: 'q1', message: 'Réponse invalide.' }]);
  });

  it('TEXTE_LIBRE non obligatoire, laissé vide : ni erreur ni reponse', () => {
    const question = q({ id: 'q1', type: 'TEXTE_LIBRE', obligatoire: false });
    const { erreurs, reponses } = analyserReponsesFormulaire([question], formulaire([]));
    expect(erreurs).toEqual([]);
    expect(reponses).toEqual([]);
  });

  it('OUI_NON : seules les valeurs 0 et 1 sont acceptées', () => {
    const question = q({ id: 'q1', type: 'OUI_NON' });
    const ok = analyserReponsesFormulaire([question], formulaire([[nomChampQuestion('q1'), '1']]));
    expect(ok.reponses).toEqual([{ questionId: 'q1', valeurNumerique: 1 }]);

    const ko = analyserReponsesFormulaire([question], formulaire([[nomChampQuestion('q1'), 'oui']]));
    expect(ko.erreurs).toEqual([{ questionId: 'q1', message: 'Réponse invalide.' }]);
  });
});
