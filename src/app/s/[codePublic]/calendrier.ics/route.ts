import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { genererIcs } from '@/lib/calendrier-ics';

interface Props {
  params: Promise<{ codePublic: string }>;
}

// Contenu public uniquement (titre/dates/lieu) : aucune donnée participant,
// donc pas d'authentification nécessaire ici.
export async function GET(_request: Request, { params }: Props) {
  const { codePublic } = await params;

  const seminaire = await prisma.seminaire.findUnique({
    where: { codePublic },
    select: { id: true, titre: true, description: true, lieu: true, dateDebut: true, dateFin: true, supprimeLe: true },
  });

  if (!seminaire || seminaire.supprimeLe !== null) {
    return new NextResponse(null, { status: 404 });
  }

  const contenu = genererIcs({
    uid: `${seminaire.id}@seminaires`,
    titre: seminaire.titre,
    description: seminaire.description,
    lieu: seminaire.lieu,
    dateDebut: seminaire.dateDebut,
    dateFin: seminaire.dateFin,
  });

  return new NextResponse(contenu, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="seminaire.ics"`,
    },
  });
}
