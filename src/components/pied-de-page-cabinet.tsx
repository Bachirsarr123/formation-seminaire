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
  return (
    <footer className="w-full border-t border-[color:var(--gris-100)] bg-[color:var(--gris-000)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-1 p-4 py-6 text-[length:var(--taille-sm)] text-[color:var(--gris-500)]">
        <p className="font-medium text-[color:var(--gris-500)]">{cabinet.nom}</p>
        {cabinet.adresse ? <p>{cabinet.adresse}</p> : null}
        {cabinet.telephoneContact ? <p>Tél : {cabinet.telephoneContact}</p> : null}
        {cabinet.emailContact ? <p>{cabinet.emailContact}</p> : null}
      </div>
    </footer>
  );
}
