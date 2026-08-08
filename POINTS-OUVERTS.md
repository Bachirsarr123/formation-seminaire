# Points ouverts

## Suite e2e à finir de stabiliser

La suite Playwright passe intégralement (51/51 après l'étape 9) en local sur
cette machine, mais la configuration a nécessité plusieurs correctifs
découverts pendant la vérification (voir historique de commits) :
vérification `webServer` par port TCP plutôt que par requête HTTP, absence de
reporter HTML. Elle n'a pas encore été éprouvée en CI ni sur une autre
machine. À surveiller à la prochaine exécution hors de cet environnement.

Un flake précis, sans rapport avec le code applicatif, est apparu à deux
reprises pendant la vérification de l'étape 9 (une exécution complète de la
suite = un flaky, sur deux exécutions, chaque fois une spec différente —
`organisateur-connexion.spec.ts` une fois, `responsive-320-zoom.spec.ts`
l'autre) : juste après la soumission du formulaire de connexion, l'URL
transite un instant par `/organisateur` avant d'atteindre
`/organisateur/seminaires`, et dépasse occasionnellement le timeout de 15s de
l'assertion `toHaveURL`. Récupéré par le réessai (`retries: 1`) les deux
fois, jamais en échec sec sur les deux tentatives — vraisemblablement la même
famille de lenteur à froid que celle déjà documentée ci-dessus (webServer,
premier accès à une route), pas un nouveau bug applicatif, mais le symptôme
est désormais assez caractérisé pour être noté précisément si ça se reproduit
ailleurs.

## Bug `Origin: null` — crash corrigé, déclencheur réel toujours ouvert

Découvert pendant l'étape 7 (import CSV), en isolant un échec réel de
`tests/e2e/organisateur-seminaire-crud.spec.ts` (reproduit à l'identique sur
l'arbre de l'étape 6 seule, sans rapport avec l'import CSV). Une requête de
Server Action portant l'en-tête `Origin: null` (chaîne littérale, pas
l'absence de l'en-tête) faisait planter le dispatch interne des Server
Actions de Next.js avec `TypeError [ERR_INVALID_URL]`, avant même que le code
de l'action ne s'exécute — remontant en 500 brut plutôt qu'une erreur
exploitable.

**Corrigé à l'étape 8** : `src/middleware.ts` rejette désormais toute requête
`POST` sous `/organisateur` dont l'en-tête `Origin` est présent mais non
analysable (le cas `null` inclus) avec un JSON `{ error: ... }` en 400,
**avant** que Next n'atteigne le code qui plantait — couvre toutes les Server
Actions de l'espace organisateur en un seul point, présentes et futures.
Vérifié sur 3 exécutions isolées (`--retries=0`) du test qui a servi à
isoler le bug : **0/3 crash** (`TypeError [ERR_INVALID_URL]` absent des trois
sorties serveur), contre 3/3 avant correctif. Test unitaire déterministe
dans `tests/unit/middleware-origin-invalide.test.ts` (confirme aussi qu'une
origine valide, absente, ou une méthode/route hors périmètre ne sont jamais
affectées par ce garde-fou).

**Ce qui reste ouvert** : la cause exacte pour laquelle le navigateur envoie
parfois `Origin: null` sur cette interaction précise (clic sur « Enregistrer
les modifications ») n'a pas été identifiée — le phénomène est intermittent
(observé sur 2 des 3 exécutions de vérification), pas systématique. Le
correctif ne le fait pas disparaître : il transforme un crash serveur en
rejet propre, mais dans ce cas précis la modification n'est toujours pas
enregistrée (l'utilisateur doit recharger et réessayer). Avant de considérer
ce point définitivement clos, il faudrait déterminer si ce comportement est
spécifique à `next dev` (peu probable en production, à vérifier sur un build
`next build && next start`) ou générique, et si des données de session déjà
valides (cookie `SameSite=Lax`) justifient d'assouplir le rejet plutôt que de
le maintenir strict.

**Nouvelle occurrence (étape 13, lot 5)** : rencontré cette fois sur
`choisirModeleAction` (rattachement d'un modèle à un séminaire) — une Server
Action différente de celle qui avait servi à isoler le bug, confirmant qu'il
n'est pas propre à `modifierSeminaireAction`. Cette fois quasi-systématique
en vérification (plusieurs échecs consécutifs sur cette machine, contre 2/3
précédemment), ce qui pointe vers une corrélation avec le délai de réponse
plutôt qu'un déclencheur purement aléatoire : `choisirModeleAction` redirige
vers une route dynamique (`/organisateur/questionnaires/[id]`) qui doit
souvent se compiler à la volée au moment même de la requête (première visite
en dev) — plus ce délai est long, plus l'anomalie semble probable.
`tests/e2e/organisateur-questionnaire-rattachement.spec.ts` recharge et
retente automatiquement sur ce message précis (même remède que celui déjà
affiché à l'utilisateur) plutôt que d'ignorer le cas.

**Investigation complète (étape 14, lot 5)** : en tentant de faire fonctionner
l'éditeur de questionnaire sans JavaScript (nouvelle exigence de ce lot,
jamais demandée pour l'espace organisateur avant), `Origin: null` s'est
révélé être la valeur envoyée **systématiquement** (pas intermittente) par
toute navigation POST native (sans JS) sous `/organisateur` — vérifié en
production (`next build && next start`), pas seulement en dev. Les parcours
participant sans JS (`/s/*`, `/mon-espace`) ne sont eux jamais affectés :
`inscription-sans-js.spec.ts` et `questionnaire-sans-js.spec.ts` passent
proprement en production, aucun `Origin: null` — ces routes n'ont jamais ce
garde-fou, `estOriginAnalysable` ne s'applique qu'à `/organisateur`.

Tenté d'assouplir le garde-fou (autoriser `Origin: null`/absent, ne rejeter
que les origines réellement étrangères) pour permettre ce cas légitime : le
middleware laisse alors passer la requête, mais **Next.js plante ensuite en
interne** avec exactement `TypeError [ERR_INVALID_URL] { input: 'null' }` —
le crash originel de l'étape 8, vérifié dans les journaux du serveur de
production au moment précis de l'échec. Le garde-fou de l'étape 8 n'est donc
pas seulement une protection CSRF qu'on pourrait relâcher : il masque un
véritable bug du dispatch interne des Server Actions de Next.js, qui plante
sur ce cas précis quel que soit notre code. Assouplir revient à remplacer un
400 propre par un 500 brut — changement rejeté, `src/middleware.ts` reste
strict (`estOriginAnalysable` inchangé depuis l'étape 8).

**Conclusion retenue** : l'espace organisateur nécessite JavaScript — voir la
décision assumée ci-dessous. Le point reste ouvert uniquement pour la partie
JS-activée du bug (intermittent, ~2/3, voir plus haut) : à réévaluer à la
prochaine montée de version de Next.js, pas quelque chose que ce dépôt peut
corriger de son côté.

## Décision assumée : l'espace organisateur nécessite JavaScript

Contrairement au parcours participant (`/s/*`, `/mon-espace` — lot 3, testé
et fonctionnel sans JS en production), l'espace `/organisateur/*` n'est **pas**
garanti fonctionner sans JavaScript, et ne le sera pas tant que le bug Next.js
ci-dessus n'est pas corrigé en amont. Assumé volontairement, pas un oubli :
les organisateurs travaillent sur ordinateur avec un navigateur récent (JS
activé par défaut, désactivé seulement par choix délibéré ou outil
d'accessibilité spécifique) — un cadre très différent de celui d'un
participant sur un lien reçu par SMS/WhatsApp, potentiellement sur un appareil
ou une connexion contrainte, où « sans JS » protège un vrai usage.

Cause précise : une navigation POST native (sans JS) sous `/organisateur`
envoie systématiquement `Origin: null`, ce qui fait planter le dispatch
interne des Server Actions de Next.js (`TypeError [ERR_INVALID_URL]`,
détail dans la section « Bug Origin: null » ci-dessus) — un bug de Next.js
lui-même, pas de ce code, et qui ne peut pas être contourné depuis
`src/middleware.ts` sans transformer un rejet propre (400) en crash brut
(500). À réévaluer à la prochaine montée de version de Next.js.

## Hypothèse assumée : un déploiement sert un seul cabinet

`src/app/page.tsx` (page d'accueil, lot 4) affiche « le » cabinet en prenant
le plus ancien (`Cabinet.findFirst` trié par `createdAt`). Le schéma est
multi-cabinet (isolation testée à l'étape 3), mais rien dans l'application
ne résout de tenant par domaine/sous-domaine — l'hypothèse est qu'un
déploiement réel correspond à un seul cabinet actif, le multi-cabinet du
schéma servant surtout à prouver l'isolation des données. Si un vrai besoin
multi-tenant sur un même domaine apparaît, cette page devra changer.

## Décision assumée : désactivation de compte sans réactivation ni protection du dernier organisateur

`/organisateur/equipe` (lot 4, étape 9) permet de désactiver un compte
(`actif = false`) mais jamais de le réactiver — aucun écran ne repose ce
champ à `true` ; c'est exactement ce que demandait le prompt (« désactivation
… jamais de suppression »), rien de plus. Un seul garde-fou existe contre le
verrouillage accidentel : un compte ne peut jamais se désactiver lui-même
(`AutoDesactivationError`, `lib/organisateur/equipe.ts`), et le bouton est en
plus absent de sa propre ligne dans l'écran (`page.tsx`).

**Ce qui reste ouvert** : rien n'empêche en revanche un organisateur de
désactiver tous les AUTRES organisateurs du cabinet un par un jusqu'à rester
seul actif — pas un verrouillage total (lui-même reste connecté), mais une
situation dont on ne peut plus revenir que par un accès direct à la base
(aucune réactivation en écran) si ce dernier compte venait ensuite à être
perdu. Non traité volontairement : le prompt ne demandait que la
désactivation, pas la protection du dernier compte actif — à réévaluer si ce
scénario se présente réellement en usage.

## ⚠️ Stockage des supports de cours : disque local, perdu à chaque redéploiement sur le plan gratuit Render

`lib/organisateur/stockage-supports.ts` écrit les fichiers téléversés
(`/organisateur/seminaires/[id]/supports`) dans un dossier `uploads/` à la
racine du conteneur — aucun service de stockage externe (S3 ou équivalent)
n'est configuré pour ce lot, conformément à la consigne ("si aucun service
n'est configuré, les fichiers sont stockés localement... fonctionnel pour la
démo").

**Le plan gratuit Render n'offre pas de disque persistant** : ce dossier vit
dans le système de fichiers éphémère du conteneur. Les fichiers survivent
aux redémarrages normaux du même conteneur, mais **sont perdus à chaque
nouveau déploiement** (`git push`, changement de configuration...) — la ligne
`SupportCours` reste en base (donc visible dans la liste), mais son
téléchargement échouera (fichier introuvable sur le nouveau conteneur).

**Non corrigé volontairement** dans ce lot : corriger nécessiterait soit un
disque persistant Render (plan payant), soit un adaptateur S3 (ou
compatible) — les deux sont hors budget/temps de ce lot, et le prompt
autorisait explicitement le repli local avec cet avertissement. L'adaptateur
est isolé (`stockage-supports.ts`, deux fonctions : `enregistrerFichierSupport`/
`lireFichierSupport`) pour qu'un futur remplacement par S3 ne touche aucun
appelant.

**À faire avant un usage réel en production** : brancher un disque
persistant Render sur `uploads/`, ou écrire un adaptateur S3 derrière la même
interface — et prévenir les organisateurs que les supports actuellement
téléversés devront être re-téléversés une fois la bascule faite (les lignes
`SupportCours` déjà en base ne pointeront plus vers un fichier existant).
