import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

// Plex a un support complet des accents français et reste lisible en petit
// corps sur écran médiocre. latin-ext nécessaire pour é/è/ç/à etc.
const policeTexte = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

// Chiffres tabulaires pour les notes, moyennes, compteurs (lot 3).
const policeChiffres = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
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
