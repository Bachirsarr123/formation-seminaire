export interface ValeursFormulaireRecueil {
  prenom: string;
  nom: string;
  fonction: string;
  organisation: string;
}

export interface EtatFormulaireRecueil {
  erreurGenerale?: string;
  erreursChamps?: Partial<Record<keyof ValeursFormulaireRecueil, string>>;
  valeurs?: ValeursFormulaireRecueil;
}
