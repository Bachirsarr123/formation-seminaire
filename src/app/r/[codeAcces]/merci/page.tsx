import { chargerRecueilPublic } from '@/lib/recueil/public';
import { PiedDePageCabinet } from '@/components/pied-de-page-cabinet';

interface Props {
  params: Promise<{ codeAcces: string }>;
}

export default async function PageRecueilMerci({ params }: Props) {
  const { codeAcces } = await params;
  const recueil = await chargerRecueilPublic(codeAcces);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-between gap-6 p-4 pb-12">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-[length:var(--taille-lg)] text-[color:var(--gris-900)]">Merci, votre réponse a bien été envoyée.</p>
        <p className="text-[color:var(--gris-600)]">Vous pouvez fermer cette page.</p>
      </div>
      {recueil ? <PiedDePageCabinet cabinet={recueil.cabinet} /> : null}
    </main>
  );
}
