import { BORNES_ECHELLE, LIBELLES_EXTREMITES_NPS, VALEUR_FORMULAIRE_SANS_OPINION, type TypeEchelle } from '@/lib/questionnaire/echelles';
import { nomChampQuestion } from '@/lib/questionnaire/validation-reponses';

interface EchelleNotationProps {
  questionId: string;
  type: TypeEchelle;
  intitule: string;
  description?: string | null;
  obligatoire: boolean;
  autoriseSansOpinion: boolean;
  libelles?: Record<'1' | '2' | '3' | '4', string> | null;
  valeurInitiale?: string;
  enErreur?: boolean;
}

/**
 * L'échelle de notation, élément signature du questionnaire : cases larges,
 * chiffre en police mono réaffiché en grand au-dessus de la rangée, deux
 * rangées au-delà de six options plutôt qu'un défilement horizontal.
 *
 * Entièrement sans JavaScript : chaque case est un input radio natif ; le
 * grand chiffre est produit par les règles CSS génériques `:has()` de
 * globals.css (une seule fois pour toute la page, pas par question).
 */
export function EchelleNotation({
  questionId,
  type,
  intitule,
  description,
  obligatoire,
  autoriseSansOpinion,
  libelles,
  valeurInitiale,
  enErreur,
}: EchelleNotationProps) {
  const { min, max } = BORNES_ECHELLE[type];
  const valeurs: number[] = [];
  for (let v = min; v <= max; v++) valeurs.push(v);

  const champ = nomChampQuestion(questionId);
  const nbTuiles = valeurs.length + (autoriseSansOpinion ? 1 : 0);
  const nbColonnes = nbTuiles > 6 ? Math.ceil(nbTuiles / 2) : nbTuiles;

  return (
    <fieldset
      id={`question-${questionId}`}
      tabIndex={-1}
      className={enErreur ? 'echelle-erreur' : undefined}
      aria-invalid={enErreur ? 'true' : undefined}
    >
      <legend className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">
        {intitule}
        {obligatoire ? <span aria-hidden="true"> *</span> : null}
      </legend>
      {description ? <p className="text-[color:var(--gris-600)]">{description}</p> : null}
      {enErreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-[#b3261e]">
          Réponse requise.
        </p>
      ) : null}

      <div className="echelle-conteneur">
        <div className="echelle-valeur-affichee" aria-hidden="true" />
        <div className="echelle-grille" style={{ gridTemplateColumns: `repeat(${nbColonnes}, minmax(0, 1fr))` }}>
          {valeurs.map((valeur) => (
            <div className="echelle-tuile" key={valeur}>
              <input
                type="radio"
                className="echelle-option"
                id={`${champ}-${valeur}`}
                name={champ}
                value={String(valeur)}
                required={obligatoire}
                defaultChecked={valeurInitiale === String(valeur)}
              />
              <label htmlFor={`${champ}-${valeur}`}>
                <span className="chiffre">{valeur}</span>
                {type === 'ECHELLE_4' && libelles ? (
                  <span className="echelle-libelle">{libelles[String(valeur) as '1' | '2' | '3' | '4']}</span>
                ) : null}
              </label>
            </div>
          ))}
          {autoriseSansOpinion ? (
            <div className="echelle-tuile echelle-tuile-sans-opinion">
              <input
                type="radio"
                className="echelle-option"
                id={`${champ}-sans-opinion`}
                name={champ}
                value={VALEUR_FORMULAIRE_SANS_OPINION}
                required={obligatoire}
                defaultChecked={valeurInitiale === VALEUR_FORMULAIRE_SANS_OPINION}
              />
              <label htmlFor={`${champ}-sans-opinion`}>Sans opinion</label>
            </div>
          ) : null}
        </div>
        {type === 'NPS' ? (
          <div className="echelle-extremites">
            <span>{LIBELLES_EXTREMITES_NPS.min}</span>
            <span>{LIBELLES_EXTREMITES_NPS.max}</span>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
