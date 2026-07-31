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
