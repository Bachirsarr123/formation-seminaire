import { prisma } from './prisma';

interface MessageAnonymeVisible {
  id: string;
  contenu: string;
  jourEnvoi: Date;
  statut: string;
  reponseOrganisateur: string | null;
  dateReponse: Date | null;
}

interface ListeMessagesAnonymes {
  visible: boolean;
  total: number;
  messages: MessageAnonymeVisible[];
}

/**
 * Un message anonyme n'est visible par l'organisateur que si le séminaire en
 * compte au moins `seuilAnonymat` (défaut 5). En dessous, liste vide + total
 * réel (l'organisateur sait combien il y en a, jamais leur contenu).
 * Au-dessus, tous les messages sont retournés dans un ordre mélangé — jamais
 * l'ordre chronologique, qui trahirait qui a écrit en premier.
 */
export async function listerMessagesAnonymes(
  seminaireId: string,
  seuilAnonymat: number,
): Promise<ListeMessagesAnonymes> {
  const total = await prisma.messageAnonyme.count({ where: { seminaireId } });

  if (total < seuilAnonymat) {
    return { visible: false, total, messages: [] };
  }

  const messages = await prisma.messageAnonyme.findMany({
    where: { seminaireId },
    select: {
      id: true,
      contenu: true,
      jourEnvoi: true,
      statut: true,
      reponseOrganisateur: true,
      dateReponse: true,
    },
  });

  return { visible: true, total, messages: melangerAleatoirement(messages) };
}

function melangerAleatoirement<T>(items: T[]): T[] {
  const copie = [...items];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copie[i] as T;
    copie[i] = copie[j] as T;
    copie[j] = temp;
  }
  return copie;
}
