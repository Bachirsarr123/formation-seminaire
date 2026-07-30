export interface ValeursFormulaireInscription {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  fonction: string;
  organisation: string;
}

export interface EtatFormulaireInscription {
  erreurGenerale?: string;
  erreursChamps?: Partial<Record<keyof ValeursFormulaireInscription, string>>;
  valeurs?: ValeursFormulaireInscription;
}
