# Points ouverts

## Suite e2e à finir de stabiliser

La suite Playwright passe intégralement (18/18) en local sur cette machine,
mais la configuration a nécessité plusieurs correctifs découverts pendant la
vérification (voir historique de commits) : vérification `webServer` par port
TCP plutôt que par requête HTTP, absence de reporter HTML. Elle n'a pas
encore été éprouvée en CI ni sur une autre machine. À surveiller à la
prochaine exécution hors de cet environnement.

## "/" renvoie 404

Taper le domaine nu (`/`) renvoie un 404 : aucune route n'existe à cet
emplacement, toutes les pages réelles sont sous `/p/[jeton]`, `/s/[codePublic]`
et `/mon-espace`. Quelqu'un qui arrive sur le domaine sans lien précis doit
pouvoir atterrir quelque part (page d'accueil du cabinet, redirection, ou
message explicite). Relève du lot agenda — non traité ici.

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
