interface CabinetPourPiedDePage {
  nom: string;
  adresse: string | null;
  telephoneContact: string | null;
  emailContact: string | null;
}

// Partagé entre toutes les pages publiques (via PagePublique) : même
// contenu, même source (Cabinet), pas de raison de le dupliquer par route.
// Placé en dehors de la colonne centrée du contenu (voir PagePublique) —
// c'est ce qui lui permet de s'étirer sur toute la largeur de l'appareil,
// avec son propre centrage interne pour que le texte reste lisible sur
// grand écran.
export function PiedDePageCabinet({ cabinet }: { cabinet: CabinetPourPiedDePage }) {
  // Nom sur sa propre ligne (identité, un peu plus marquée), coordonnées
  // réunies sur une seconde ligne séparée par « · » — jamais une ligne par
  // champ : sur la plupart des appareils, le pied de page tient en deux
  // lignes au total (une troisième seulement si la ligne de coordonnées
  // doit se replier sur un très petit écran).
  const coordonnees = [cabinet.adresse, cabinet.telephoneContact ? `Tél : ${cabinet.telephoneContact}` : null, cabinet.emailContact].filter(
    (valeur): valeur is string => Boolean(valeur),
  );

  return (
    <footer className="w-full border-t border-[color:var(--gris-100)] bg-[color:var(--gris-000)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-1 p-4 py-6 text-center text-[length:var(--taille-sm)] text-[color:var(--gris-500)] sm:text-left">
        <p className="font-medium text-[color:var(--gris-500)]">{cabinet.nom}</p>
        {coordonnees.length > 0 ? <p>{coordonnees.join(' · ')}</p> : null}
      </div>
    </footer>
  );
}
