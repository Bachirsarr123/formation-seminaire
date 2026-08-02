'use client';

import { useEffect } from 'react';
import { purger } from '@/lib/client/sauvegarde-locale';

/**
 * Cette page n'est jamais atteinte sans un succès réel (voir page.tsx :
 * redirection vers ici seulement si aRepondu est vrai en base) — son
 * montage est donc le bon endroit pour purger la sauvegarde locale, comme
 * documenté dans lib/client/sauvegarde-locale.ts depuis le lot 2.
 */
export function PurgeSauvegardeLocale({ cle }: { cle: string }) {
  useEffect(() => {
    purger(cle);
  }, [cle]);

  return null;
}
