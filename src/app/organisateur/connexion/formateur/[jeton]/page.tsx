import { FormulaireConfirmer } from './formulaire-confirmer';

interface Props {
  params: Promise<{ jeton: string }>;
}

// Ne consomme jamais le jeton sur ce simple GET (un scanner de lien
// d'antivirus ou un aperçu de messagerie qui précharge l'URL le brûlerait
// avant l'utilisateur réel) : la confirmation explicite ci-dessous est ce
// qui déclenche consommerLienMagique, dans une Server Action.
export default async function PageConfirmerLienMagique({ params }: Props) {
  const { jeton } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Connexion</h1>
      <p className="text-[color:var(--gris-600)]">Cliquez pour accéder à votre espace.</p>
      <FormulaireConfirmer jeton={jeton} />
    </main>
  );
}
