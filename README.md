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

## Mode essai
Accueil → « 🧪 Mode essai » : partie d'entraînement séparée (codes 1234 / DJ 5678), la vraie soirée n'est jamais touchée. Onglet Jeu → « Remplir avec des données fictives ». Les QR codes imprimés en essai ouvrent l'essai ; un vrai QR code ramène toujours à la vraie soirée. Lien direct : `/?essai=1` (et `/?essai=0` pour sortir).

## Musique intégrée
Le serveur cherche un extrait de 30 s (API iTunes d'Apple, puis Deezer en secours) via `/api/preview`. Le bouton ▶ du DJ (ou de l'animateur + DJ) lance la musique et le chrono ensemble ; la musique se coupe à la fin de l'extrait. Onglet Manches : « 🔊 Vérifier les extraits » (bilan ✓ / ⚠️ / ✗, « 🎲 Autre morceau » et « Remplacer tous les ✗ » qui tire un autre morceau du même style jusqu'à en trouver un) et, par morceau, « Écouter / choisir l'extrait » (choix mémorisé). Désactivable par une case à cocher (les liens Apple Music / Spotify / YouTube restent en secours).

## Bibliothèque
`public/library.js` : 300 morceaux en 11 styles (8 styles × 30 morceaux + Rock, Rap et RnB, Génériques télé × 20). Le pack par défaut reprend les 8 styles d'origine ; les 3 nouveaux se choisissent dans l'onglet Manches.

## Playlists Deezer, mémoire, service de musique
- Onglet Manches → style « 🌐 Playlist Deezer… » : recherche de playlists Deezer (`/api/dzpl?q=`), tirage au sort parmi leurs morceaux (`/api/dzpl?id=`), titres nettoyés (« - Remastered », « (feat. …) »…). Sans compte.
- Mémoire : chaque manche publiée enregistre ses morceaux (`played`, par partie main/essai). Le tirage prend d'abord des morceaux jamais joués. Réglages → « Oublier l'historique ».
- Réglages → « Mon service de musique » (Apple Music / Spotify / Deezer / YouTube) : son lien de secours s'affiche en premier chez le DJ.

## Lancement de la soirée et écran géant
- Adresse courte de l'écran géant : `/ecran` (mode essai : `/ecran-essai`, aussi `/tv`). Affichée avec un bouton « Copier » dans Réglages et Distribuer.
- Onglet Jeu → « 🎬 Lancer la soirée » en 3 étapes pilotées depuis le téléphone : ① afficher toutes les équipes et leurs membres sur l'écran géant (taille ajustée automatiquement pour tout faire tenir), ② les règles, ③ c'est parti (direct).
- QR codes sur l'écran géant (étape facultative « 📲 QR codes à l'écran ») : tous à la fois (taille ajustée) ou un par un avec ◀ ▶ et choix du numéro depuis le téléphone. Les codes des équipes ne sont envoyés à l'écran que pendant cet affichage. Pour jouer chacun pour soi : tirage avec 1 personne par équipe.

## Appli Android TV (écran géant sans PC)
- Code : `android/` (une activité WebView plein écran qui ouvre `/ecran`, icône + bannière TV). Fabriquée sans Gradle par `android/build.sh` (aapt2, javac, d8, zipalign, apksigner).
- GitHub Actions (`.github/workflows/android-tv.yml`) fabrique l'appli à chaque changement dans `android/` et la dépose dans `public/tv.apk` → téléchargeable sur `/tv.apk`. Compte-rendu : `build-log-tv.txt`.
- Clé de signature : `android/tv.keystore` (mot de passe « blindtest »), dédiée à cette appli installée à la main.
- Télécommande : OK = recharger, OK ×5 ou Menu = vraie soirée / mode essai, Retour ×2 = quitter.

## Impressions en PDF et verrou des équipes
- `public/pdf.js` : mini-générateur PDF (A4, Helvetica, QR codes vectoriels) – sur iPhone, l'appli installée ne peut pas utiliser « Imprimer », le PDF passe par le menu de partage (Imprimer / Enregistrer dans Fichiers).
- Onglet Distribuer : chaque document en PDF + « 📦 Tout en un PDF » (choix des documents).
- 🔒 Verrou des équipes (onglet Équipes, proposé après l'impression des feuilles) : tirage, création et déplacements bloqués ; le serveur refuse aussi tout changement de codes d'équipe tant que le verrou est actif.
