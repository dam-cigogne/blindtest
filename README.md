# Blind test – appli de soirée

Appli web (sans installation) pour animer un blind test par équipes : import Excel des invités, tirage au sort des équipes, feuilles avec QR codes, écran DJ guidé, saisie des réponses sur le téléphone des chefs d'équipe, correction tolérante aux fautes de frappe, classement secret sur le téléphone de l'animateur et podium final sur l'écran géant.

## Mise en ligne (une seule fois)

1. Le code est sur GitHub (dépôt `dam-cigogne/blindtest`).
2. Sur Cloudflare : **Workers & Pages → Créer → Importer un dépôt Git** → choisir `blindtest` → **Déployer** (laisser les réglages proposés, la commande de déploiement est `npx wrangler deploy`).
3. Cloudflare donne une adresse du type `https://blindtest.<votre-sous-domaine>.workers.dev`.
4. Ouvrez cette adresse sur votre téléphone → **Je suis l'animateur** → créez votre code animateur.

Chaque modification poussée sur GitHub est redéployée automatiquement.

## Avant la soirée

1. **Équipes** : importez le fichier Excel (ou collez la liste), choisissez le nombre de personnes par équipe, puis tirez au sort. Les conjoints restent ensemble.
2. **Manches** : 8 manches de 5 morceaux sont prêtes. Vous pouvez changer le style de chaque manche, tirer d'autres morceaux au sort ou taper les vôtres.
3. **Réglages** : définissez le code DJ.
4. **Distribuer** : imprimez les feuilles d'équipe (1 page par équipe avec son QR code), la liste pour l'annonce et la fiche DJ (QR + playlist).
5. **Répétition** : Jeu → Démarrer → « Réponses d'essai » → clore, publier… puis Réglages → **Remettre la partie à zéro**.

## Installer l'appli et garder ses parties

- **Installer** (facultatif) : iPhone → Safari → Partager → « Sur l'écran d'accueil » ; Android → Chrome → menu ⋮ → « Installer l'application ». Sans installation, le lien internet fonctionne pareil.
- **Mes parties enregistrées** (Réglages) : préparez équipes et manches, puis « Enregistrer comme nouvelle partie ». La partie reste figée sur le serveur. Vous pouvez en garder jusqu'à 30 et charger celle du soir (impossible pendant une partie en cours).
- **Quitter** : bouton 🚪 sur chaque écran. Lien de secours : `/?reset` pour revenir à l'accueil sur un téléphone.

## Pendant la soirée

- Le DJ lance l'extrait et appuie sur son bouton vert : le chrono démarre sur tous les écrans.
- Les chefs d'équipe tapent titre et artiste ; tout est enregistré automatiquement.
- À la fin de chaque manche, l'animateur clôture, valide les réponses douteuses et publie : les bonnes réponses s'affichent sur l'écran géant.
- Le classement reste visible uniquement sur le téléphone de l'animateur. À la fin, une case à cocher affiche le podium sur l'écran géant.

## Fichiers

- `worker.js` : serveur (Cloudflare Worker + Durable Object, une partie à la fois, données conservées).
- `matcher.js` : correction tolérante aux fautes de frappe.
- `public/index.html` : l'appli (accueil, animateur, DJ, équipes, écran géant).
- `public/library.js` : bibliothèque de morceaux par style (8 styles × 8 morceaux).
- `wrangler.toml` : configuration Cloudflare.

## Consommation

Une soirée représente environ 20 000 à 30 000 requêtes, sous la limite gratuite de Cloudflare (100 000 par jour).
