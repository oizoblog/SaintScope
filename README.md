# SaintScope v0.2 — MVP hors ligne

Application web progressive (PWA) en français, sans dépendances et sans frais d'API.

## Fonctions disponibles
- Caméra mobile et import d'une image, aperçu local (aucun envoi).
- Recherche dans 24 fiches de saints (données iconographiques initiales, à relire avant diffusion publique).
- Filtre interactif par attributs, résultats classés par nombre d'attributs concordants (ce n'est **pas** un score de confiance).
- Historique local des fiches enregistrées, effaçable.
- Cache hors ligne via service worker et manifest d'installation.

## Non disponible
- Identification automatique d'une image par IA. Le moteur de reconnaissance, les tests de précision et les vérifications éditoriales restent à développer.
- Synchronisation de l'historique entre appareils.

## Déploiement GitHub Pages
1. Créer un dépôt public `SaintScope`.
2. Copier les fichiers **à la racine** du dépôt, puis commit/push.
3. Settings > Pages > Deploy from a branch > main > /(root).
4. Ouvrir l'URL HTTPS fournie. Sur iPhone, Safari > Partager > Sur l'écran d'accueil ; sur Android, menu du navigateur > Installer.

En local, lancer `python -m http.server 8000` depuis ce dossier puis ouvrir http://localhost:8000. Le service worker ne fonctionne pas en ouvrant le fichier `index.html` directement.

## Étape suivante
Tester 20-50 images réelles ; préparer une base de fiches sourcées ; ajouter un backend sécurisé de reconnaissance visuelle (ne jamais intégrer une clé API dans le JavaScript public). Prévoir un mode « identification incertaine ».
