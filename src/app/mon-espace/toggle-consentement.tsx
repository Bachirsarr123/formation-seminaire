'use client';

interface Props {
  libelle: string;
  actif: boolean;
  retirerAction: () => Promise<void>;
  autoriserAction: () => Promise<void>;
}

// Retrait et acceptation demandent le même nombre de clics : même bouton,
// même position, seul le libellé change. Une case facultative ne doit
// jamais ressembler à une étape obligatoire du parcours.
export function ToggleConsentement({ libelle, actif, retirerAction, autoriserAction }: Props) {
  return (
    <div className="flex items-start justify-between gap-3 text-[length:var(--taille-sm)] text-[color:var(--gris-700)]">
      <p className="flex-1">{libelle}</p>
      <form action={actif ? retirerAction : autoriserAction}>
        <button
          type="submit"
          className="min-h-[44px] whitespace-nowrap rounded-[var(--rayon-sm)] bg-[color:var(--gris-100)] px-3 text-[color:var(--gris-800)]"
        >
          {actif ? 'Retirer' : 'Autoriser'}
        </button>
      </form>
    </div>
  );
}
