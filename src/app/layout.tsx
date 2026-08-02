import localFont from 'next/font/local';
import './globals.css';

// Auto-hébergées (fichiers dans fonts/, licence SIL OFL 1.1 — voir
// fonts/LICENSE-IBM-PLEX.txt) plutôt que next/font/google : le build ne doit
// dépendre d'aucun appel réseau externe, et aucune page participant ne doit
// faire de requête vers les serveurs Google. Le sous-ensemble "latin" d'IBM
// Plex couvre U+0000-00FF (ASCII + Latin-1 Supplement), qui contient déjà
// tous les caractères accentués français (é, è, ç, à...) — "latin-ext"
// n'ajoute que du Vietnamien/Polonais/Turc etc., inutile ici.
const policeTexte = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/ibm-plex-sans-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-plex-sans',
  display: 'swap',
});

// Chiffres tabulaires pour les notes, moyennes, compteurs (lot 3).
const policeChiffres = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-mono-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Séminaires',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${policeTexte.variable} ${policeChiffres.variable}`}>
      <body>{children}</body>
    </html>
  );
}
