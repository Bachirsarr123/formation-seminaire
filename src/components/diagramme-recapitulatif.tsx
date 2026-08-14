import type { ResultatQuestionFermee } from '@/lib/questionnaire/resultats';

// Une couleur par question, même cycle que BarreDistribution — harmonieux
// par construction (accent/secondaire/tertiaire dérivées ensemble, voir
// lib/design/couleur-accent.ts).
const COULEURS_BARRE = ['var(--couleur-accent)', 'var(--couleur-secondaire)', 'var(--couleur-tertiaire)'];

/**
 * Diagramme récapitulatif, un coup d'œil sur TOUTES les questions notées du
 * questionnaire — automatique et générique (pas codé pour un questionnaire
 * précis) : une barre par question dont la moyenne a un sens numérique
 * (NOTE_5, NOTE_10, ECHELLE_4, NPS, OUI_NON), ramenée en % de son échelle
 * propre pour rester comparable d'une question à l'autre. Les questions à
 * choix multiples et texte libre n'ont pas de moyenne unique (Règle « pas de
 * filtre/moyenne sur des choix non ordonnés ») : elles restent affichées
 * au-dessus (distribution / liste de réponses), jamais ici.
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
      <div className="flex flex-col gap-4">
        {questionsNotees.map((q, index) => (
          <div key={q.questionId} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[color:var(--gris-800)]">{q.intitule}</span>
              <span className="chiffre shrink-0 text-[length:var(--taille-sm)] font-semibold text-[color:var(--gris-900)]">
                {q.moyennePourcentage}%
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)]">
              <div
                className="h-4 rounded-[var(--rayon-sm)]"
                style={{ width: `${q.moyennePourcentage}%`, background: COULEURS_BARRE[index % COULEURS_BARRE.length] }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
