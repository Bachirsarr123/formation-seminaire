import 'server-only';
import { createHmac } from 'node:crypto';

// Réexporté pour les appelants serveur (actions.ts) : le honeypot vit dans un
// fichier séparé, importable depuis un composant client, qui ne tire pas
// node:crypto dans le bundle du navigateur.
export { NOM_CHAMP_HONEYPOT, estHoneypotRempli } from './anti-spam-honeypot';

const DELAI_MINIMUM_MS = 3000;
const FENETRE_LIMITE_IP_MS = 10 * 60 * 1000;
const LIMITE_INSCRIPTIONS_PAR_IP = 5;
const DUREE_IDEMPOTENCE_MS = 5 * 60 * 1000;

function secretSignatureFormulaire(): string {
  const secret = process.env.FORM_SIGNING_SECRET;
  if (!secret) throw new Error('FORM_SIGNING_SECRET manquant.');
  return secret;
}

export function genererJetonFormulaire(): { timestamp: string; signature: string } {
  const timestamp = Date.now().toString();
  const signature = createHmac('sha256', secretSignatureFormulaire()).update(timestamp).digest('hex');
  return { timestamp, signature };
}

/**
 * Un bot qui bricole le champ timestamp caché doit aussi connaître le secret
 * serveur pour produire une signature valide — reculer l'horodatage à la
 * main, sans la bonne signature, ne suffit pas à contourner le délai
 * minimum de 3 secondes.
 */
export function verifierDelaiFormulaire(timestamp: string, signature: string): boolean {
  const attendu = createHmac('sha256', secretSignatureFormulaire()).update(timestamp).digest('hex');
  if (attendu !== signature) return false;

  const emis = Number(timestamp);
  if (!Number.isFinite(emis)) return false;

  return Date.now() - emis >= DELAI_MINIMUM_MS;
}

// En mémoire pour ce lot : ne tient pas la charge sur plusieurs instances
// serveur (chacune a sa propre Map). À remplacer par un magasin partagé
// (Redis...) en cas de déploiement multi-instance.
const tentativesParIp = new Map<string, number[]>();

export function verifierLimiteIP(ip: string): boolean {
  const maintenant = Date.now();
  const tentatives = (tentativesParIp.get(ip) ?? []).filter((t) => maintenant - t < FENETRE_LIMITE_IP_MS);

  if (tentatives.length >= LIMITE_INSCRIPTIONS_PAR_IP) {
    tentativesParIp.set(ip, tentatives);
    return false;
  }

  tentatives.push(maintenant);
  tentativesParIp.set(ip, tentatives);
  return true;
}

// Absorbe les doubles clics / renvois de formulaire : la même clé
// d'idempotence, soumise deux fois de suite, retourne la même promesse
// plutôt que de retraiter l'inscription une seconde fois.
const cacheIdempotence = new Map<string, { promesse: Promise<unknown>; expiration: number }>();

export function avecIdempotence<T>(cle: string, executer: () => Promise<T>): Promise<T> {
  const maintenant = Date.now();
  const entree = cacheIdempotence.get(cle);
  if (entree && entree.expiration > maintenant) {
    return entree.promesse as Promise<T>;
  }

  const promesse = executer();
  cacheIdempotence.set(cle, { promesse, expiration: maintenant + DUREE_IDEMPOTENCE_MS });
  return promesse;
}
