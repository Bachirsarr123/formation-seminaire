import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Diagnostic ponctuel, distinct de /api/sante (qui, lui, conditionne le
// health check Render — ne doit jamais échouer pour une raison qui
// n'affecte pas la disponibilité générale du service) : vérifie
// spécifiquement que la table `fichier_stocke` (nouveau stockage des
// logos/CV/supports, voir POINTS-OUVERTS.md) est bien joignable, pour
// diagnostiquer à distance un échec d'upload sans accès aux logs Render.
// Public comme /api/sante — ne renvoie qu'un statut de schéma, jamais de
// données.
export async function GET() {
  try {
    await prisma.fichierStocke.count();
    return NextResponse.json({ statut: 'ok' }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (erreur) {
    return NextResponse.json(
      { statut: 'erreur', message: erreur instanceof Error ? erreur.message : String(erreur) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
