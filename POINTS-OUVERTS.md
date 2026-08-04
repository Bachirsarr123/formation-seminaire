# Points ouverts

## Suite e2e à finir de stabiliser

La suite Playwright passe intégralement (18/18) en local sur cette machine,
mais la configuration a nécessité plusieurs correctifs découverts pendant la
vérification (voir historique de commits) : vérification `webServer` par port
TCP plutôt que par requête HTTP, absence de reporter HTML. Elle n'a pas
encore été éprouvée en CI ni sur une autre machine. À surveiller à la
prochaine exécution hors de cet environnement.

## Durée de conservation RGPD à obtenir du cabinet — bloquant avant mise en ligne

Les trois `dureeConservation` de `src/lib/consentement/textes.ts` (version
`v1.0-2026-07`) sont actuellement vides dans le dépôt (une valeur de test
temporaire porte localement le marqueur `QA TEMPORAIRE`, non committée — à ne
jamais committer telle quelle). C'est une mention juridique réelle : elle ne
peut pas être inventée dans le code, le cabinet doit la fournir pour chacune
des trois finalités (INSCRIPTION_EVALUATION, COMMUNICATIONS,
PARTAGE_EMPLOYEUR).

Un garde-fou existe désormais : `validerTextesConsentementProduction()`,
appelée depuis `src/instrumentation.ts` au démarrage du serveur, fait échouer
le démarrage en production (`NODE_ENV=production`) si un de ces textes est
vide ou porte le marqueur placeholder. Donc tant que le cabinet n'a pas fourni
les vraies mentions, une mise en production plantera au démarrage — c'est
volontaire, plutôt que d'afficher un texte juridique factice à un vrai
participant.

## Bug : `Origin: null` fait planter `modifierSeminaireAction` (exception non gérée)

Découvert pendant l'étape 7 (import CSV), en isolant un échec réel de
`tests/e2e/organisateur-seminaire-crud.spec.ts` — reproduit à l'identique sur
l'arbre de l'étape 6 seule (rien à voir avec `ImportEnAttente` ni l'import
CSV, écartés explicitement par ce test d'isolation).

Une requête de Server Action portant l'en-tête `Origin: null` (chaîne
littérale, pas l'absence de l'en-tête) fait planter `modifierSeminaireAction`
(`src/app/organisateur/(protege)/seminaires/[id]/modifier/actions.ts`) avec
une exception non gérée : `TypeError [ERR_INVALID_URL]: Invalid URL` (`input:
'null'`), qui remonte en 500 côté client au lieu d'un message d'erreur
exploitable. Ce cas d'en-tête `Origin: null` n'est pas un artefact de test :
il se produit avec certains navigateurs mobiles, après certaines
redirections, ou depuis un contexte confiné (iframe sandboxée, etc.) — donc
potentiellement en usage réel, pas seulement sous Playwright.

À traiter à l'étape 8 (durcissement) : les Server Actions de l'espace
organisateur doivent renvoyer une erreur propre à l'appelant dans ce cas,
jamais laisser remonter une exception non interceptée. Le test e2e ci-dessus
reproduit déjà le problème de façon fiable (isolé, `--retries=0`, arbre
propre) — c'est le critère de correction : il doit passer sans exception
serveur une fois corrigé.

## Hypothèse assumée : un déploiement sert un seul cabinet

`src/app/page.tsx` (page d'accueil, lot 4) affiche « le » cabinet en prenant
le plus ancien (`Cabinet.findFirst` trié par `createdAt`). Le schéma est
multi-cabinet (isolation testée à l'étape 3), mais rien dans l'application
ne résout de tenant par domaine/sous-domaine — l'hypothèse est qu'un
déploiement réel correspond à un seul cabinet actif, le multi-cabinet du
schéma servant surtout à prouver l'isolation des données. Si un vrai besoin
multi-tenant sur un même domaine apparaît, cette page devra changer.
