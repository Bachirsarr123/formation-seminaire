interface CabinetPourPiedDePage {
  nom: string;
  adresse: string | null;
  telephoneContact: string | null;
  emailContact: string | null;
}

// Partagé entre le formulaire de recueil (/r) et sa consultation (/rc) : même
// contenu, même source (Cabinet), pas de raison de le dupliquer par route
// comme BoutonCopier (qui, lui, diffère légèrement d'un écran à l'autre).
export function PiedDePageCabinet({ cabinet }: { cabinet: CabinetPourPiedDePage }) {
  return (
    <footer className="flex flex-col gap-1 border-t border-[color:var(--gris-100)] pt-4 text-[length:var(--taille-sm)] text-[color:var(--gris-500)]">
      <p className="font-medium text-[color:var(--gris-500)]">{cabinet.nom}</p>
      {cabinet.adresse ? <p>{cabinet.adresse}</p> : null}
      {cabinet.telephoneContact ? <p>Tél : {cabinet.telephoneContact}</p> : null}
      {cabinet.emailContact ? <p>{cabinet.emailContact}</p> : null}
    </footer>
  );
}
