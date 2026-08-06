import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cible du health check Render : une requête HTTP qui répond avant même
// qu'une vraie requête utilisateur n'ait touché la base ne dit rien de la
// santé réelle du service (base injoignable, migration non appliquée...) —
// d'où la connexion effective (SELECT 1) plutôt qu'un simple 200 statique.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ statut: 'ok' }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ statut: 'erreur' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
