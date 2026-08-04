# Points ouverts

## Suite e2e à finir de stabiliser

La suite Playwright passe intégralement (18/18) en local sur cette machine,
mais la configuration a nécessité plusieurs correctifs découverts pendant la
vérification (voir historique de commits) : vérification `webServer` par port
TCP plutôt que par requête HTTP, absence de reporter HTML. Elle n'a pas
encore été éprouvée en CI ni sur une autre machine. À surveiller à la
prochaine exécution hors de cet environnement.

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

## Hypothèse assumée : un déploiement sert un seul cabinet

`src/app/page.tsx` (page d'accueil, lot 4) affiche « le » cabinet en prenant
le plus ancien (`Cabinet.findFirst` trié par `createdAt`). Le schéma est
multi-cabinet (isolation testée à l'étape 3), mais rien dans l'application
ne résout de tenant par domaine/sous-domaine — l'hypothèse est qu'un
déploiement réel correspond à un seul cabinet actif, le multi-cabinet du
schéma servant surtout à prouver l'isolation des données. Si un vrai besoin
multi-tenant sur un même domaine apparaît, cette page devra changer.
