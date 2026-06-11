# Mur de Photos Live — Anniversaire 25 ans

## 1. Contexte

- Activité : mur de photos en temps réel projeté sur écran/projecteur pendant la fête.
- Les invités prennent/uploadent des photos depuis leur smartphone → elles s'affichent en direct sur le mur.
- Surprise totale pour la copine — découverte le jour J.
- ~80+ invités.
- Salle **sans wifi** → réseau local possible (option par défaut), mais on garde l'option cloud en fallback.

## 2. Contraintes

- Deadline : > 1 mois → marge confortable, mais on vise un **vertical slice fonctionnel rapidement**, puis polish.
- Doit être **mobile-first** (les invités utilisent leur téléphone).
- Doit être **robuste en conditions réelles** : mauvais réseau, 80+ utilisateurs, photos lourdes (smartphones modernes = 3-12MB/photo).
- Pas de vrais fonds, pas de blockchain pour ce projet.
- Code propre, typé (TypeScript), choix d'archi justifiés.

## 3. Deux modes de déploiement (à choisir plus tard)

L'app est conçue pour fonctionner dans les deux cas, via une interface commune `PhotoService`. Le switch se fait par variable d'environnement `BACKEND=local|supabase`.

### Mode LOCAL (recommandé si pas de wifi salle)
- Routeur wifi portable (~25-30€, type GL.iNet) crée un réseau local "Anniv 25 ans" — supporte 80+ connexions.
- Laptop branché au projecteur fait tourner le serveur (Next.js + API Express + Socket.io).
- Photos stockées sur disque local (dossier `uploads/`), métadonnées en SQLite.
- Invités scannent un QR code → connexion wifi auto + ouverture de l'URL locale (`http://192.168.x.x:3000`).
- Aucune dépendance internet. Fonctionne même en sous-sol.
- Plan B : hotspot du laptop si le routeur portable tombe en panne.

### Mode ONLINE (si wifi salle dispo ou fallback)
- Hébergement : Vercel (gratuit) pour le front/API.
- Backend : Supabase (gratuit) — Storage pour les photos, Realtime (websocket) pour le push live, Postgres pour les métadonnées.
- Limites free tier largement suffisantes pour 80 invités (~200 connexions realtime concurrentes, 1GB storage si compression respectée).

### Ce qui ne change PAS entre les deux modes
- Frontend Next.js, pages, composants, compression d'image côté client.
- Interface `PhotoService` (upload, listPhotos, onNewPhoto) — seule l'implémentation change.

## 4. Stack technique

- **Framework** : Next.js (App Router) + TypeScript
- **Style** : TailwindCSS
- **Local** : Express + Socket.io + SQLite (better-sqlite3) + stockage fichiers sur disque
- **Online** : Supabase (Storage + Realtime + Postgres)
- **Compression image** : côté client via canvas (resize + JPEG quality) avant upload — obligatoire dans les deux modes

## 5. Fonctionnalités

### MVP
- Page `/` (mobile, invités) :
  - Accès caméra ou galerie
  - Compression automatique de l'image avant envoi
  - Preview + bouton "Envoyer"
  - Feedback d'envoi (succès / erreur / retry si réseau coupé)
  - Queue d'upload persistée (IndexedDB/localStorage) en cas de coupure réseau
- Page `/wall` (écran/projecteur) :
  - Affichage temps réel des nouvelles photos (mosaïque ou diaporama animé)
  - Mode plein écran / kiosk
  - Animation d'arrivée de chaque nouvelle photo (le "wow effect")
- Page `/admin` (organisateur) :
  - Liste des photos, possibilité de masquer/supprimer
  - Reset de la session

### Nice-to-have (si le temps le permet)
- Thème visuel personnalisé (couleurs, prénom, décor anniversaire)
- Filtres/cadres photo amusants avant envoi
- Compteur de photos / nombre de participants
- Export de toutes les photos en zip après la soirée
- QR code généré automatiquement (page dédiée à imprimer/afficher)

## 6. Parcours utilisateurs

### Invité
1. Scanne le QR code (affiché sur table/entrée)
2. Arrive sur `/` (page mobile)
3. Prend une photo ou choisit dans sa galerie
4. Preview → envoie
5. Voit sa photo apparaître sur le mur projeté quelques secondes après

### Organisateur (toi)
1. Avant la fête : setup serveur (local ou online), génère le QR code, teste le flow complet
2. Pendant la fête : laptop branché au projecteur sur `/wall` en plein écran, surveillance via `/admin` sur ton téléphone
3. Après la fête : export des photos (nice-to-have) ou récupération directe du dossier `uploads/`

## 7. Plan de développement (séquencé)

1. Setup Next.js + TypeScript + Tailwind, structure dossiers, interface `PhotoService`
2. `LocalPhotoService` (Express + Socket.io + stockage fichiers) — premier vertical slice
3. Page `/` : upload + compression côté client (mock puis branché au service)
4. Page `/wall` : affichage temps réel + animations d'arrivée
5. Page `/admin` : modération basique
6. `SupabasePhotoService` (même interface) pour le mode online
7. Polish UI : thème anniversaire, transitions, QR code auto-généré
8. Robustesse : queue d'upload avec retry, gestion offline, mode kiosk

## 8. Checklist Jour J (à compléter en Phase 4)

- [ ] Routeur wifi portable chargé/testé
- [ ] Laptop + câble HDMI/projecteur testés ensemble
- [ ] QR codes imprimés (accès wifi + URL app)
- [ ] Test de charge réaliste avant la fête (plusieurs appareils en simultané)
- [ ] Plan B réseau (hotspot 4G)
- [ ] Mode kiosk activé sur le laptop (pas de veille, pas de notifications)

## 9. Décisions en attente

- [ ] Choix final mode local vs online (à trancher après tests)
- [ ] Thème visuel / nom de l'événement à afficher sur le mur
- [ ] Budget routeur wifi portable si mode local retenu
