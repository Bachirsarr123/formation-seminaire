import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { resoudreContexteParticipant } from '@/lib/contexte-participant';
import { SoumissionDejaEffectueeError, soumettreReponses } from '@/lib/soumission';
import { soumissionSchema } from '@/lib/validation/soumission.schema';

interface Props {
  params: Promise<{ jeton: string }>;
}

// Même contrat que la page : jeton inconnu/expiré/annulé → 404, jamais 401/403.
// `jeton` n'est jamais inclus dans une réponse JSON ni journalisé.
export async function POST(request: Request, { params }: Props) {
  const { jeton } = await params;

  const contexte = await resoudreContexteParticipant(jeton);
  if (!contexte) {
    return NextResponse.json({ error: 'Introuvable.' }, { status: 404 });
  }

  const corps = soumissionSchema.safeParse(await request.json());
  if (!corps.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  try {
    await soumettreReponses({
      jeton,
      questionnaireId: corps.data.questionnaireId,
      reponses: corps.data.reponses.map((r) => ({
        ...r,
        valeurOptions: r.valeurOptions as Prisma.InputJsonValue | undefined,
      })),
    });
  } catch (erreur) {
    if (erreur instanceof SoumissionDejaEffectueeError) {
      return NextResponse.json({ error: 'Réponse déjà enregistrée.' }, { status: 409 });
    }
    throw erreur;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
