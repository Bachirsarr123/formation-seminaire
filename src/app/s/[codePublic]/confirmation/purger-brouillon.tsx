'use client';

import { useEffect } from 'react';
import { purger } from '@/lib/client/sauvegarde-locale';

// Cette page n'est atteinte qu'après une soumission réussie : c'est
// précisément le moment de purger le brouillon local du formulaire
// d'inscription (nom, e-mail, téléphone ne doivent pas survivre au parcours
// sur un poste partagé).
export function PurgerBrouillon() {
  useEffect(() => {
    purger('inscription-brouillon');
  }, []);

  return null;
}
