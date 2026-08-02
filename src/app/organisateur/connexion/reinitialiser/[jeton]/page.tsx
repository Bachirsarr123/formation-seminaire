import { FormulaireReinitialiser } from './formulaire-reinitialiser';

interface Props {
  params: Promise<{ jeton: string }>;
}

export default async function PageReinitialiser({ params }: Props) {
  const { jeton } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Nouveau mot de passe</h1>
      <FormulaireReinitialiser jeton={jeton} />
    </main>
  );
}
