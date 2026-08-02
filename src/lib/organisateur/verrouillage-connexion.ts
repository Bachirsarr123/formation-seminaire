import 'server-only';
import { prisma } from '../prisma';

const FENETRE_MS = 15 * 60 * 1000;
const SEUIL_TENTATIVES = 5;
const BACKOFF_BASE_MS = 30 * 1000;
const BACKOFF_MAX_MS = 15 * 60 * 1000;

export interface EtatVerrouillage {
  autorise: boolean;
  attenteMs: number;
}

function calculerBlocageMs(tentatives: number): number {
  if (tentatives < SEUIL_TENTATIVES) return 0;
  const paliers = tentatives - SEUIL_TENTATIVES;
  return Math.min(BACKOFF_BASE_MS * 2 ** paliers, BACKOFF_MAX_MS);
}

/**
 * Verrouillage scopé au couple (email normalisé, IP), jamais à l'email seul :
 * un verrou par email est un déni de service trivial pour quiconque connaît
 * l'adresse d'un organisateur (il suffit d'échouer volontairement, depuis
 * n'importe où, pour bloquer le titulaire légitime). Ici, un attaquant
 * échouant depuis SON IP ne bloque que (email, cette IP) — jamais l'accès du
 * titulaire depuis sa propre IP habituelle.
 *
 * Une ligne sans échec depuis plus de FENETRE_MS est traitée comme
 * réinitialisée (table à durée de vie courte par construction, pas de purge
 * nécessaire à cette échelle).
 */
export async function verifierTentativeConnexion(emailNormalise: string, ip: string): Promise<EtatVerrouillage> {
  const ligne = await prisma.tentativeConnexionOrganisateur.findUnique({
    where: { emailNormalise_ip: { emailNormalise, ip } },
  });

  if (!ligne) return { autorise: true, attenteMs: 0 };

  const perimee = ligne.dernierEchecLe !== null && Date.now() - ligne.dernierEchecLe.getTime() > FENETRE_MS;
  if (perimee) return { autorise: true, attenteMs: 0 };

  if (ligne.bloqueJusqua && ligne.bloqueJusqua.getTime() > Date.now()) {
    return { autorise: false, attenteMs: ligne.bloqueJusqua.getTime() - Date.now() };
  }

  return { autorise: true, attenteMs: 0 };
}

export async function enregistrerEchecConnexion(emailNormalise: string, ip: string): Promise<void> {
  const existante = await prisma.tentativeConnexionOrganisateur.findUnique({
    where: { emailNormalise_ip: { emailNormalise, ip } },
  });

  const perimee = existante?.dernierEchecLe ? Date.now() - existante.dernierEchecLe.getTime() > FENETRE_MS : false;
  const tentatives = !existante || perimee ? 1 : existante.tentatives + 1;
  const bloqueJusqua = tentatives >= SEUIL_TENTATIVES ? new Date(Date.now() + calculerBlocageMs(tentatives)) : null;

  await prisma.tentativeConnexionOrganisateur.upsert({
    where: { emailNormalise_ip: { emailNormalise, ip } },
    create: { emailNormalise, ip, tentatives, dernierEchecLe: new Date(), bloqueJusqua },
    update: { tentatives, dernierEchecLe: new Date(), bloqueJusqua },
  });
}

export async function reinitialiserTentativesConnexion(emailNormalise: string, ip: string): Promise<void> {
  await prisma.tentativeConnexionOrganisateur.deleteMany({ where: { emailNormalise, ip } });
}

// ============================================================
// Temporisation globale par IP, en complément — protège contre un attaquant
// qui teste beaucoup d'adresses différentes depuis une même IP, chacune
// restant sous le seuil par couple ci-dessus. En mémoire, comme
// lib/anti-spam.ts : ne tient pas la charge sur plusieurs instances serveur,
// à remplacer par un magasin partagé en cas de déploiement multi-instance.
// ============================================================

const FENETRE_GLOBALE_MS = 15 * 60 * 1000;
const LIMITE_GLOBALE_PAR_IP = 20;

const tentativesGlobalesParIp = new Map<string, number[]>();

export function verifierLimiteGlobaleIP(ip: string): boolean {
  const maintenant = Date.now();
  const tentatives = (tentativesGlobalesParIp.get(ip) ?? []).filter((t) => maintenant - t < FENETRE_GLOBALE_MS);
  return tentatives.length < LIMITE_GLOBALE_PAR_IP;
}

export function enregistrerTentativeGlobaleIP(ip: string): void {
  const maintenant = Date.now();
  const tentatives = (tentativesGlobalesParIp.get(ip) ?? []).filter((t) => maintenant - t < FENETRE_GLOBALE_MS);
  tentatives.push(maintenant);
  tentativesGlobalesParIp.set(ip, tentatives);
}
