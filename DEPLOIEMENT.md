# Déploiement — Render + Neon

Hébergement : [Render](https://render.com) (Web Service Node), base PostgreSQL
chez [Neon](https://neon.tech).

## 1. Variables d'environnement

À configurer dans Render (Dashboard → le service → **Environment**).

### Permanentes (lues par l'application à chaque requête)

| Variable                   | Exemple / format                                                  | Où l'obtenir                                                                 |
| --------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `DATABASE_URL`              | `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/seminaire_platform?sslmode=require` | Neon → Dashboard du projet → **Connection string**. **Prendre la chaîne DIRECTE, pas celle du pooler** (pas de `-pooler` dans le nom d'hôte) — voir encadré ci-dessous. |
| `FORM_SIGNING_SECRET`       | 64 caractères hex                                                   | Générer avec `openssl rand -hex 32`                                          |
| `CONSENTEMENT_HASH_SECRET`  | 64 caractères hex                                                   | Générer avec `openssl rand -hex 32`, **différent** de `FORM_SIGNING_SECRET`  |

`PORT` est fourni automatiquement par Render (`next start` le lit tout seul,
rien à configurer). `NODE_ENV=production` est appliqué automatiquement par
Next.js pour `next build`/`next start`, pas besoin de le définir à la main.

> **Pourquoi la chaîne directe et pas le pooler Neon** : Neon propose une
> chaîne « pooled » (PgBouncer, hôte en `...-pooler....neon.tech`) pensée pour
> des environnements serverless à très nombreuses connexions courtes. Ce
> service tourne sur un serveur Node persistant (Render), qui gère déjà son
> propre pool de connexions (Prisma Client) — le pooler Neon n'apporte rien
> ici et complique inutilement `prisma migrate deploy` (les migrations ont
> besoin d'une connexion directe, le mode transaction de PgBouncer casse les
> verrous que Prisma Migrate pose). Une seule chaîne directe, utilisée à la
> fois par l'application et par les migrations : plus simple, sans piège.

### Ponctuelles (uniquement pour l'initialisation, voir §4 — à retirer de Render juste après usage)

| Variable                     | Exemple                                  |
| ------------------------------ | ------------------------------------------ |
| `CABINET_NOM`                  | `Cabinet Méridien Formation`               |
| `CABINET_COULEUR_PRIMAIRE`     | `#0F4C81`                                  |
| `CABINET_EMAIL_CONTACT`        | `contact@meridien-formation.sn`            |
| `CABINET_TELEPHONE_CONTACT`    | `+221771234567` (format international complet, jamais `07...`) |
| `ORGANISATEUR_EMAIL`           | `organisatrice@meridien-formation.sn`      |
| `ORGANISATEUR_NOM`             | `Ndiaye`                                   |
| `ORGANISATEUR_PRENOM`          | `Awa`                                      |
| `ORGANISATEUR_MOT_DE_PASSE`    | mot de passe réel, ≥ 12 caractères, jamais celui d'un exemple |

Un `.env.example` documente les variables permanentes avec des valeurs
factices — ne jamais y mettre de vraie valeur.

## 2. Build et démarrage

Configuration du Web Service Render :

| Réglage              | Valeur                                                     |
| ---------------------- | ------------------------------------------------------------ |
| Runtime               | Node                                                        |
| Build Command          | `npm ci && npx prisma generate && npm run build`            |
| Start Command          | `npx prisma migrate deploy && npm run start`                |
| Health Check Path      | `/api/sante`                                                |

Le `Start Command` applique les migrations en attente à chaque démarrage,
**avant** que le serveur ne se mette à répondre : un déploiement qui inclut
une nouvelle migration l'applique tout seul, sans étape manuelle. `prisma
migrate deploy` est sans effet s'il n'y a rien de nouveau à appliquer — donc
sans risque à relancer à chaque redémarrage.

`/api/sante` vérifie une vraie connexion à la base (`SELECT 1`), pas
seulement que le process tourne — Render ne bascule le trafic vers la
nouvelle instance qu'une fois ce endpoint à 200.

## 3. Première mise en service — build à blanc

Avant de pointer le service sur la vraie base Neon, il est recommandé de
vérifier une fois en local que le build et les migrations passent contre une
base neuve (déjà fait pendant la préparation de ce déploiement — voir
historique). En cas de doute, refaire le test avec `npx prisma migrate
deploy` pointé sur une base Postgres vide avant de déployer sur Render.

## 4. Procédure d'initialisation (une seule fois, sur une base vide)

`scripts/initialiser-production.ts` crée le premier cabinet, le premier
compte organisateur et le modèle de questionnaire par défaut. Il refuse de
s'exécuter si la base contient déjà la moindre donnée (cabinet, utilisateur
ou questionnaire) — impossible de l'exécuter deux fois par erreur.

Étapes :

1. Une fois le premier déploiement Render passé (le service répond sur
   `/api/sante`), renseigner les variables ponctuelles du §1
   (`CABINET_*`, `ORGANISATEUR_*`) dans l'onglet **Environment** de Render,
   puis redéployer pour qu'elles soient prises en compte.
2. Lancer le script **une seule fois**, par l'une de ces deux voies :
   - **Depuis un poste local**, en pointant temporairement sur la base de
     production :
     ```bash
     export DATABASE_URL="<chaîne directe Neon>"
     export CABINET_NOM="..." CABINET_COULEUR_PRIMAIRE="..." \
       CABINET_EMAIL_CONTACT="..." CABINET_TELEPHONE_CONTACT="..." \
       ORGANISATEUR_EMAIL="..." ORGANISATEUR_NOM="..." \
       ORGANISATEUR_PRENOM="..." ORGANISATEUR_MOT_DE_PASSE="..."
     npm run init:production
     ```
     Fermer ensuite le terminal (ou `unset` les variables) pour ne pas
     laisser le mot de passe dans l'historique du shell.
   - **Depuis le Shell Render** (onglet **Shell** du service, si le plan
     l'inclut) : `npm run init:production` — les variables déjà réglées à
     l'étape 1 sont automatiquement disponibles dans cet environnement.
3. Vérifier le message de confirmation (nom du cabinet, e-mail de
   l'organisateur, nom du modèle de questionnaire).
4. Retirer `CABINET_*` et `ORGANISATEUR_MOT_DE_PASSE` des variables
   d'environnement Render (elles ne servent plus à rien une fois le compte
   créé — mieux vaut ne pas laisser un mot de passe en clair dans une
   configuration qui traîne).
5. Transmettre l'e-mail et le mot de passe à l'organisatrice/l'organisateur
   par un canal sûr (jamais par e-mail en clair) ; lui recommander de le
   changer dès la première connexion (« Mot de passe oublié » depuis l'écran
   de connexion fonctionne aussi pour un premier changement volontaire).

Aucune donnée fictive, aucun participant de test n'est créé par ce script —
`prisma/seed.ts` (données de démonstration) refuse de tourner en production
et ne doit jamais être exécuté contre Neon.

## 5. Appliquer une migration ultérieure sur la base de production

Cas normal (le service tourne déjà) :

1. Développer et tester la migration en local (`npm run prisma:migrate`, qui
   crée le fichier dans `prisma/migrations/`).
2. Committer le nouveau dossier de migration et pousser sur la branche
   déployée sur Render.
3. Render rebuild et redémarre le service : le `Start Command`
   (`npx prisma migrate deploy && npm run start`) applique la migration
   avant que le nouveau code ne commence à servir du trafic. Rien de manuel.

Cas exceptionnel (appliquer une migration sans redéployer, ou vérifier
l'état des migrations à distance) — depuis un poste local :

```bash
export DATABASE_URL="<chaîne directe Neon>"
npx prisma migrate status   # voir ce qui est déjà appliqué / en attente
npx prisma migrate deploy   # applique les migrations en attente
```

Ne jamais utiliser `prisma migrate dev` ni `prisma migrate reset` contre la
base de production : la première peut générer une migration de dérive
inattendue, la seconde efface tout. Les deux sont réservés au développement
local (`npm run seed`/`npm run db:reset`, qui refusent eux-mêmes de tourner
hors `localhost`).
