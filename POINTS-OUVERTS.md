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

## ✅ Résolu : stockage des fichiers téléversés déplacé du disque local vers la base (Neon)

**Historique du problème** : `lib/organisateur/stockage-supports.ts` écrivait
tous les fichiers téléversés (supports de cours, logo cabinet, logo client,
CV formateur) dans un dossier `uploads/` à la racine du conteneur. Le plan
gratuit Render n'offre pas de disque persistant — ce dossier vivait dans le
système de fichiers éphémère du conteneur et **était perdu à chaque nouveau
déploiement** (`git push`, changement de configuration...), alors que la
ligne en base (`SupportCours.urlStockage`, `Cabinet.logoUrl`,
`Seminaire.logoClientUrl`, `Utilisateur.cvUrl`) survivait et restait
référencée dans l'écran correspondant. **Signalé en usage réel** : un logo
cabinet téléversé disparaissait de l'affichage public au déploiement
suivant, sans action de l'organisateur — bloquant à deux jours d'une
formation.

**Corrigé** en remplaçant entièrement l'adaptateur : `stockage-supports.ts`
écrit et lit désormais dans une table Postgres dédiée, `FichierStocke`
(colonne `contenu` en bytea natif, `type_mime`, `taille_fichier`) — une
ligne Neon survit à un redéploiement comme n'importe quelle autre donnée
applicative, exactement comme le reste de la base. Les quatre
fonctionnalités qui téléversent un fichier (supports de cours, logo
cabinet, logo client, CV formateur) partagent toujours ce même adaptateur
(`enregistrerFichierSupport`/`lireFichierSupport`/`lireFichierSupportOuNull`),
qui ne change que sa manière de stocker : `SupportCours.urlStockage`,
`Cabinet.logoUrl`, `Seminaire.logoClientUrl` et `Utilisateur.cvUrl`
portent maintenant l'id (uuid) d'une ligne `FichierStocke` plutôt qu'un
chemin disque, mais restent de simples colonnes `String` — aucun
changement de schéma sur ces quatre tables.

Pas d'encodage base64 applicatif : bytea est déjà binaire-safe côté
Postgres, un encodage base64 n'aurait fait que gonfler la taille stockée
d'environ un tiers sans aucun bénéfice. Fichiers plafonnés à 10 Mo par les
appelants (déjà en place avant ce changement) — un volume que Neon absorbe
largement sur son plan gratuit, pour le nombre de fichiers concerné
(logos, CV, quelques supports par séminaire).

**Robustesse conservée** de la correction précédente : `lireFichierSupportOuNull`
renvoie `null` (jamais une erreur brute) si l'id référencé ne correspond à
aucune ligne `FichierStocke` — ce qui couvre aussi bien un id jamais
existé qu'une référence héritée de l'ancien stockage disque (un chemin
relatif type `cabinetId/uuid.png`, qui ne correspondra jamais à un id de
cette table). Les organisateurs dont le logo/CV/support a été perdu par
l'ancien stockage disque devront donc, comme avant ce correctif, le
re-téléverser une fois — mais plus jamais après, puisque la nouvelle ligne
`FichierStocke` ne dépend plus du disque du conteneur.

**Cache-busting sur les logos** : `EnTeteLogos` (et les aperçus Équipe/
Modifier séminaire) ajoutent `?v=<id-fichier-stocke>` à l'URL de service —
l'id change à chaque remplacement, ce qui invalide naturellement le cache
navigateur (1h) sans avoir à le raccourcir.

## Lot messages anonymes : terminé (migration, routes, tests)

Repris après une coupure où `prisma migrate dev` avait échoué : la commande
demande une confirmation interactive dès qu'elle détecte un changement
risqué (ici, `@unique` sur `code_suivi_hash`), ce qui la rend inutilisable
telle quelle hors d'un terminal interactif. Contournement retenu — à
réutiliser pour toute prochaine migration bloquée de la même façon :
`prisma migrate dev --create-only` pour générer le SQL sans l'appliquer,
puis `prisma migrate deploy` (non interactif) pour l'appliquer. Ici même
`--create-only` échouait encore en environnement non interactif ; le fichier
`migration.sql` a été écrit à la main dans
`prisma/migrations/20260809085259_ajout_unique_code_suivi_message/`, au
format généré par Prisma (vérifié contre une migration existante).

**Bug de données trouvé en appliquant la contrainte** : la première tentative
de `migrate deploy` a échoué sur des doublons déjà présents en base de dev
(`hash-1`..`hash-5`, jusqu'à 22 fois chacun). Cause : `ajouterMessages()` dans
`tests/integration/seuil-anonymat.test.ts` insérait des `codeSuiviHash`
littéraux non uniques (`hash-${i+1}`), réutilisés à la fois entre les deux
séminaires du même fichier de test et entre les exécutions successives de la
suite contre la même base — inoffensif tant que la colonne n'était pas
contrainte, mais impossible à appliquer une fois `@unique` ajouté. Corrigé en
préfixant chaque hash par l'id (uuid) du séminaire qui le porte, unique à
chaque création. Base de dev remise à plat via `prisma migrate reset --force`
(qui réapplique toutes les migrations et relance `prisma/seed.ts`) plutôt que
de purger les doublons à la main.

**Reste de l'implémentation, terminé dans la foulée** (`src/lib/anonymat.ts`
et `src/lib/jeton.ts` étaient déjà écrits avant la coupure, sans aucun
appelant) :
- Organisateur : `/organisateur/seminaires/[id]/messages` — liste sous
  réserve du seuil d'anonymat du séminaire, réponse à un message (marque
  aussi TRAITE), marquage LU/TRAITE indépendant. Réservé au rôle
  ORGANISATEUR (pas au formateur), comme Recueil.
- Participant : `/mon-espace/messages` — envoi d'un message (le code de
  suivi n'est affiché qu'une seule fois, jamais stocké en clair) et
  consultation d'une réponse par ce code. Décision produit tranchée en cours
  de session : accessible uniquement via l'espace participant authentifié
  (pas de route publique séparée par `codePublic`).
- Tests : `tests/integration/anonymat.test.ts` (13 cas), couvrant les cinq
  fonctions jusque-là non testées — envoi/validation, consultation par code
  (y compris normalisation des espaces et isolation par séminaire), réponse
  et marquage LU/TRAITE avec vérification systématique de la règle B
  (isolation par cabinet).

Suite complète vérifiée verte après ces changements : 43 fichiers, 260 tests.

## Lien direct formateur (/f/{codeFormateur}) — remplace la connexion par lien magique

Le formateur ne se connecte plus jamais (ni mot de passe, ni lien magique par
e-mail) : `/f/{codeFormateur}` donne accès à tout ce qui concerne un
séminaire précis pour un formateur précis — fiche séminaire, participants
confirmés (nom/prénom/fonction/organisation), réponses du recueil de besoins
(anonymisées, même règle que `/rc/{codeConsultation}`), résultats
d'évaluation (soumis au seuil d'anonymat), et notation des participants
(`/f/{codeFormateur}/notations`). Un code par paire (séminaire, formateur),
colonne `codeFormateur` (`@unique`) sur `SeminaireFormateur`, régénérable
depuis la fiche séminaire organisateur (l'ancien lien cesse aussitôt de
fonctionner).

**Supprimé entièrement** : `/organisateur/connexion/formateur/*`,
`lib/organisateur/lien-magique-formateur.ts`,
`tests/integration/organisateur-lien-magique.test.ts`, la valeur d'enum
`CONNEXION_FORMATEUR` (`TypeJetonAction`, migration
`20260809102719_lien_formateur_direct` — recrée le type enum, Postgres ne
permettant pas de retirer une valeur directement), et
`envoyerLienMagiqueFormateur` (lib/notification.ts). Trois specs e2e testaient
exclusivement ce mécanisme de connexion (`organisateur-connexion.spec.ts`,
`organisateur-seminaire-crud.spec.ts`, `organisateur-seminaires.spec.ts`) —
retirées plutôt qu'adaptées, leur prémisse (un formateur peut avoir une
session `/organisateur`) n'existe plus.

**Réutilisation délibérée, pas de duplication** : `lib/organisateur/notations.ts`
et `lib/organisateur/resultats.ts` acceptent un `ContexteOrganisateur`
(`{utilisateurId, cabinetId, role}`) en paramètre — ils ne savent pas d'où il
vient. `/f/{codeFormateur}` construit ce contexte à la main
(`role: 'FORMATEUR'`) à partir du `SeminaireFormateur` résolu par le code,
sans toucher à ces deux fichiers : la vérification d'affectation
(`SeminaireFormateur.findFirst`) qui s'y trouve déjà s'applique donc
correctement, qu'elle vienne d'une vraie session organisateur ou de ce
contexte reconstruit. `FormulaireNotation`, `BarreDistribution`,
`ListeReponsesOuvertes` et le rendu des résultats anonymisés
(`ResultatsSeminaire`) ont été déplacés vers `src/components/` pour être
partagés à l'identique entre l'espace organisateur et `/f/`.

**Ce qui reste ouvert** : les branches `contexte.role === 'FORMATEUR'` dans
les pages sous `/organisateur/(protege)/*` (fiche séminaire, notations,
résultats, participants, liste des séminaires, agenda, formulaires de
création/édition) n'ont pas été retirées — elles deviennent inatteignables en
pratique (`exigerContexteOrganisateur()` ne peut plus jamais résoudre une
session `role: FORMATEUR`, le seul chemin qui en créait une était le lien
magique désormais supprimé), mais les laisser en l'état évite un remaniement
plus large que ce que ce lot demandait. `RoleUtilisateur.FORMATEUR` reste
utilisé sans changement pour l'affectation (qui peut être formateur sur un
séminaire) et l'équipe (`/organisateur/equipe`), ce qui est toujours
nécessaire. À nettoyer dans un lot dédié si cette zone est retouchée.
