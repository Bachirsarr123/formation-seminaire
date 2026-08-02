import { FormulaireMotDePasseOublie } from './formulaire-mot-de-passe-oublie';

export default function PageMotDePasseOublie() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-[length:var(--taille-xl)] text-[color:var(--gris-900)]">Mot de passe oublié</h1>
      <FormulaireMotDePasseOublie />
    </main>
  );
}
