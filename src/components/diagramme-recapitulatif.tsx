import type { ResultatQuestionFermee } from '@/lib/questionnaire/resultats';

// Une couleur par question, même cycle que BarreDistribution — harmonieux
// par construction (accent/secondaire/tertiaire dérivées ensemble, voir
// lib/design/couleur-accent.ts).
const COULEURS_BARRE = ['var(--couleur-accent)', 'var(--couleur-secondaire)', 'var(--couleur-tertiaire)'];

// Hauteur de la zone de tracé, en pixels — sert à la fois de hauteur CSS et
// de référence pour que les barres (height: N%) se calculent contre une
// hauteur définie, pas contre "auto".
const HAUTEUR_GRAPHIQUE = 220;
const GRADUATIONS = [100, 75, 50, 25, 0];

/**
 * Diagramme récapitulatif, un coup d'œil sur TOUTES les questions notées du
 * questionnaire — automatique et générique (pas codé pour un questionnaire
 * précis) : une colonne par question dont la moyenne a un sens numérique
 * (NOTE_5, NOTE_10, ECHELLE_4, NPS, OUI_NON), ramenée en % de son échelle
 * propre pour rester comparable d'une question à l'autre. Les questions à
 * choix multiples et texte libre n'ont pas de moyenne unique (Règle « pas de
 * filtre/moyenne sur des choix non ordonnés ») : elles restent affichées
 * au-dessus (distribution / liste de réponses), jamais ici.
 *
 * Vrai diagramme en colonnes avec axes (pas une liste de barres horizontales
 * comme BarreDistribution) : axe des ordonnées en %, axe des abscisses avec
 * un numéro par question (Q1, Q2...) — l'intitulé complet, potentiellement
 * long, vit dans la légende en dessous plutôt que sous chaque colonne, pour
 * ne jamais faire se chevaucher deux libellés voisins. Toujours du CSS pur,
 * aucune bibliothèque de graphiques (même contrainte que BarreDistribution).
 */
export function DiagrammeRecapitulatif({ questions }: { questions: ResultatQuestionFermee[] }) {
  const questionsNotees = questions.filter(
    (q): q is ResultatQuestionFermee & { moyennePourcentage: number } => q.moyennePourcentage !== null,
  );
  if (questionsNotees.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 rounded-[var(--rayon-md)] border border-[color:var(--gris-100)] p-4">
      <div>
        <h2 className="text-[length:var(--taille-md)] text-[color:var(--gris-900)]">Vue d&apos;ensemble — toutes les questions</h2>
        <p className="text-[length:var(--taille-sm)] text-[color:var(--gris-600)]">
          Moyenne de chaque question notée, ramenée en % de son échelle pour pouvoir les comparer entre elles.
        </p>
      </div>

      <div className="flex gap-3">
        {/* Axe des ordonnées (%) */}
        <div
          className="flex shrink-0 flex-col justify-between text-right text-[length:var(--taille-xs)] text-[color:var(--gris-500)]"
          style={{ height: HAUTEUR_GRAPHIQUE }}
        >
          {GRADUATIONS.map((g) => (
            <span key={g} className="chiffre">{g}%</span>
          ))}
        </div>

        {/* Zone de tracé : quadrillage + colonnes, ancrées sur l'axe des abscisses (bordure basse) */}
        <div
          className="relative min-w-0 flex-1 border-b border-l border-[color:var(--gris-300)]"
          style={{ height: HAUTEUR_GRAPHIQUE }}
        >
          {GRADUATIONS.filter((g) => g > 0 && g < 100).map((g) => (
            <div
              key={g}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-[color:var(--gris-100)]"
              style={{ bottom: `${g}%` }}
            />
          ))}

          <div className="flex h-full items-stretch justify-around gap-2 px-2">
            {questionsNotees.map((q, index) => (
              <div key={q.questionId} className="flex h-full flex-1 flex-col-reverse items-center">
                <div
                  className="w-full max-w-[48px] rounded-t-[var(--rayon-sm)]"
                  style={{ height: `${q.moyennePourcentage}%`, background: COULEURS_BARRE[index % COULEURS_BARRE.length] }}
                  title={`${q.intitule} — ${q.moyennePourcentage}%`}
                />
                <span className="chiffre mb-1 text-[length:var(--taille-xs)] text-[color:var(--gris-800)]">
                  {q.moyennePourcentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Axe des abscisses : un numéro par colonne, aligné avec la zone de tracé ci-dessus */}
      <div className="flex gap-3">
        <div className="shrink-0" style={{ width: '3ch' }} aria-hidden="true" />
        <div className="flex flex-1 justify-around gap-2 px-2">
          {questionsNotees.map((q, index) => (
            <span key={q.questionId} className="chiffre flex-1 text-center text-[length:var(--taille-xs)] text-[color:var(--gris-600)]">
              Q{index + 1}
            </span>
          ))}
        </div>
      </div>

      {/* Légende : intitulé complet de chaque question, jamais tronqué sous l'axe */}
      <ul className="flex flex-col gap-1">
        {questionsNotees.map((q, index) => (
          <li key={q.questionId} className="flex items-baseline gap-2">
            <span className="chiffre shrink-0 text-[length:var(--taille-sm)] font-semibold" style={{ color: COULEURS_BARRE[index % COULEURS_BARRE.length] }}>
              Q{index + 1}
            </span>
            <span className="text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">{q.intitule}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
