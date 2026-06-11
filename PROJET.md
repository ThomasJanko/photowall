# Mur de Photos Live — Anniversaire 25 ans

> Dernière mise à jour : 11/06/2026 — état du projet pour reprise future (par toi ou par une IA).

## 1. Contexte

- Activité : mur de photos en temps réel projeté sur écran/projecteur pendant la fête.
- Les invités prennent/uploadent des photos depuis leur smartphone → elles s'affichent en direct sur le mur.
- Surprise totale pour la copine — découverte le jour J.
- ~80+ invités.
- Salle **sans wifi** → mode réseau local retenu par défaut, option Supabase (en ligne) gardée en fallback/abstraction.

## 2. Contraintes

- Mobile-first (les invités utilisent leur téléphone).
- Robuste en conditions réelles : mauvais réseau, 80+ utilisateurs, photos lourdes.
- Pas de vrais fonds, pas de blockchain pour ce projet.
- Code propre, typé (TypeScript), choix d'archi justifiés.
- **Règle de dev** : toute nouvelle fonctionnalité passe par l'interface `PhotoService`
  (`src/lib/photoService.ts`) et doit être implémentée dans **les deux** backends
  (`localPhotoService.ts` ET `supabasePhotoService.ts`), même si l'un des deux
  reste minimal/no-op. Ne jamais coder une feature qui ne marche que dans un mode
  sans le documenter clairement.

## 3. Statut global

✅ = fait et fonctionnel · 🟡 = prompt fourni à une IA (Cursor), à vérifier/tester · ⬜ = pas commencé

| Fonctionnalité | Statut |
|---|---|
| Setup projet (Next.js + TS + Tailwind + Express/Socket.io) | ✅ |
| Upload + compression côté client + queue retry | ✅ |
| `/wall` : grille temps réel + spotlight 10s + confettis | ✅ |
| Réactions emoji (❤️🔥😂🎉) avec animation flottante + compteurs | ✅ |
| `/admin` : liste + masquage individuel | ✅ |
| QR code (script CLI `scripts/generate-qr.ts`) | ✅ |
| Thème de couleurs selon l'heure | 🟡 |
| Page `/countdown` (compte à rebours + animation finale) | 🟡 |
| Page `/retrospective` (diaporama + musique fin de soirée) | 🟡 |
| Indicateur de reconnexion sur `/wall` | 🟡 |
| Page `/qr` dédiée (affichage grand écran) | 🟡 |
| `/admin` : sélection multiple + export ZIP + suppression en masse | 🟡 |
| Dockerisation (Dockerfile + docker-compose) | 🟡 |
| Protection `/admin` par code (ADMIN_CODE) | 🟡 |

Les items 🟡 ont été spécifiés via des prompts détaillés donnés à une IA de code
(Cursor) le 11/06/2026. **Vérifier avant la fête s'ils ont bien été implémentés et
testés** — sinon, redonner les prompts (conservés dans l'historique de conversation
Claude, ou à régénérer à partir de ce fichier).

## 4. Architecture

### 4.1 Vue d'ensemble

- **Frontend** : Next.js (App Router) + TypeScript + TailwindCSS, dans `app/`.
- **Backend local** : serveur Express + Socket.io (`server/index.ts`), port `4000`.
  Stockage **fichiers JSON** (pas de SQLite/base de données — choix fait pour
  éviter les problèmes de compilation native sous Windows).
- **Backend online (optionnel)** : Supabase (Storage + Postgres + Realtime).
- **Switch de backend** : variable d'env `NEXT_PUBLIC_BACKEND` (`local` par défaut
  ou `supabase`), lu dans `src/lib/photoService.ts`.

### 4.2 Interface commune — `src/lib/photoService.ts`

Toute l'app (pages, composants) ne dépend QUE de l'interface `PhotoService` :
`upload`, `listPhotos`, `onNewPhoto`, `onPhotoRemoved`, `react`, `unreact`,
`onReaction`, `hidePhoto` (+ futurs ajouts : `exportPhotos`, `hidePhotos`,
`onConnectionChange`, voir section 6). `getPhotoService()` retourne
`LocalPhotoService` ou `SupabasePhotoService` selon `NEXT_PUBLIC_BACKEND`.

### 4.3 Mode LOCAL (par défaut)

- `src/lib/localPhotoService.ts` : parle au serveur Express via `fetch` (REST)
  + `socket.io-client` (temps réel).
- `src/lib/serverUrl.ts` : `getServerUrl()` dérive automatiquement l'URL du
  serveur (`window.location.hostname` + port `4000`), avec override possible via
  `NEXT_PUBLIC_SERVER_URL`. Indispensable pour l'accès depuis les téléphones via
  IP locale (`http://192.168.x.x`).
- `server/db.ts` : stockage JSON (`data/photos.json`), lecture/écriture
  synchrones (volumes faibles). Contient `PhotoRow`, `REACTION_EMOJIS`,
  `insertPhoto`, `listVisiblePhotos`, `hidePhoto`, `getPhoto`, `addReaction`
  (avec migration douce pour les anciennes lignes sans `reactions`).
- `server/index.ts` : routes `GET/POST /api/photos`, `DELETE /api/photos/:id`,
  `POST /api/photos/:id/react`, fichiers statiques sur `/uploads`. Émet les
  events Socket.io `photo:new`, `photo:removed`, `photo:reaction`.
- Photos stockées dans `data/uploads/`.

### 4.4 Mode ONLINE (Supabase, optionnel)

- `src/lib/supabasePhotoService.ts` : Storage (bucket `photos`) + table
  Postgres `photos` (`id, url, created_at, hidden, reactions jsonb`) + Realtime
  (`postgres_changes` sur INSERT/UPDATE).
- ⚠️ Nécessite `REPLICA IDENTITY FULL` sur la table pour recevoir `payload.old`
  (utilisé pour diffuser les réactions). Setup détaillé en commentaire en tête
  du fichier.
- `@supabase/supabase-js` est une dépendance **permanente** du projet (même en
  mode local) car `photoService.ts` utilise `require()` pour le lazy-load, et
  webpack résout les `require()` statiquement au build.

### 4.5 Pages existantes

- `/` : upload (caméra/galerie), compression canvas (`compressImage.ts`,
  maxDimension 1600px, qualité 0.75), preview, queue retry persistée en
  localStorage (`uploadQueue.ts`, IDs générés via `generateId()` — pas
  `crypto.randomUUID()` car indisponible en HTTP non-sécurisé sur IP locale).
- `/wall` : fond dégradé violet/rose + confettis CSS continus, grille de
  photos avec animation `photo-pop-in`, spotlight plein écran 10s pour chaque
  nouvelle photo (`spotlight-pop-in`), réactions emoji avec toggle par appareil
  (localStorage `wall:my-reactions`), animation `reaction-float`, anti-spam par
  cooldown (1.5s).
- `/admin` : liste des photos visibles, bouton masquer par photo.

### 4.6 Animations CSS (`src/app/globals.css`)

`photo-pop-in`, `spotlight-pop-in`, `reaction-float`, `confetti-fall` /
`.confetti-piece`. **Ne pas modifier ces keyframes existantes** — toute nouvelle
animation doit être ajoutée à la fin du fichier sous un nom différent.

## 5. Setup & lancement

```bash
cd app
npm install
npm run dev:all   # lance Next.js (3000) + serveur Express/Socket.io (4000)
```

- Config via `app/.env.local` (voir `.env.local.example`) :
  `NEXT_PUBLIC_BACKEND` (`local`/`supabase`), `NEXT_PUBLIC_SERVER_URL`
  (override optionnel), variables Supabase si mode online.
- QR code d'accès : `scripts/generate-qr.ts` (génère un QR vers l'IP locale du
  serveur).

## 6. Fonctionnalités spécifiées (🟡 prompts donnés, à vérifier)

Détails complets des specs dans l'historique de conversation Claude du
11/06/2026. Résumé pour reprise rapide :

1. **Thème horaire** (`src/lib/timeTheme.ts`, `getTimeTheme()`) : palette de
   `/wall` qui change selon l'heure (vif l'après-midi → doré le soir → bleu nuit
   tard). Calcul après mount uniquement (évite mismatch hydratation).

2. **`/countdown`** : compte à rebours vers une date cible (constante
   `TARGET_DATE` à éditer), gros affichage, animation de célébration finale +
   lien vers `/wall`.

3. **`/retrospective`** : diaporama plein écran de toutes les photos
   (`listPhotos()`), fondu enchaîné, musique de fond (`<audio>` avec fichier à
   placer dans `public/music/`), écran de démarrage requis (autoplay bloqué),
   bouton retour `/wall`.

4. **Indicateur de reconnexion sur `/wall`** : `onConnectionChange` ajouté
   (optionnellement) à `PhotoService`, badge "🔌 Reconnexion en cours..." si
   le socket local est déconnecté. No-op acceptable côté Supabase.

5. **`/qr`** : page dédiée affichant en grand le QR vers l'URL publique
   (`NEXT_PUBLIC_APP_URL`, à définir une fois déployé).

6. **`/admin` avancé** : checkboxes + "tout sélectionner", export ZIP
   (`POST /api/photos/export`, lib `archiver`), suppression en masse
   (`DELETE /api/photos/bulk`). Réutilise `hidePhoto` existant.

7. **Docker** : Dockerfile multi-stage + docker-compose, volume persistant pour
   `data/` (photos.json + uploads), variables `NEXT_PUBLIC_*` injectées au
   build. Scripts `dev`/`dev:all` non touchés.

8. **Protection admin** : variable `ADMIN_CODE` (serveur uniquement, jamais
   `NEXT_PUBLIC_*`), écran de connexion sur `/admin`, middleware
   `requireAdmin` sur les routes de modération (`DELETE /api/photos/:id`,
   `/bulk`, `/export`), token stocké en localStorage côté client.

## 7. Jour J — points de vigilance (rappel)

- Routeur wifi portable / 4G dédié, positionné central, IP fixe pour le laptop.
- Projecteur + drap blanc tendu ou écran, câble HDMI + adaptateur.
- Laptop : pas de veille, branché secteur, terminal dédié pour `npm run dev:all`.
- QR codes imprimés + affichés (page `/qr` une fois prête).
- Backup régulier de `data/photos.json` + `data/uploads/` (clé USB).
- Plan B : hotspot 4G si routeur en panne ; tablette/TV si projecteur en panne.

## 8. Décisions en attente

- [ ] Hébergement final : VPS (Docker) vs Netlify — impacte le mode
      (`local` impossible sur Netlify, nécessite `supabase` ou un VPS pour le
      serveur Express).
- [ ] Vérifier/tester les 8 fonctionnalités 🟡 avant la fête.
- [ ] Définir `ADMIN_CODE` et `NEXT_PUBLIC_APP_URL` une fois l'hébergement choisi.
- [ ] Choisir la musique pour `/retrospective` (fichier dans `public/music/`).
