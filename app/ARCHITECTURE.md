# Architecture — Mur de souvenirs

Base réutilisable pour événements (anniversaires, mariages, etc.).  
Next.js (App Router) + Express/Socket.io en mode local, Supabase en mode online.

## Structure du projet

```
app/
├── src/
│   ├── app/              # Pages Next.js (routes)
│   ├── components/       # UI partagée (ConfettiBackground, EventThemeProvider…)
│   ├── config/
│   │   └── event.ts      # ★ Configuration centralisée de l'événement
│   └── lib/
│       ├── photoService.ts      # Interface + factory (local / Supabase)
│       ├── localPhotoService.ts
│       ├── supabasePhotoService.ts
│       ├── privateMessages.ts   # Messages privés (séparé de PhotoService)
│       ├── adminAuth.ts
│       ├── applyEventTheme.ts
│       └── timeTheme.ts
├── server/
│   ├── index.ts          # API Express + Socket.io
│   ├── db.ts             # Stockage photos public (JSON)
│   └── messagesDb.ts     # Messages privés (JSON séparé)
└── data/                 # Fichiers persistés (local)
```

## Configuration événement

Tout ce qui varie d'un événement à l'autre vit dans **`src/config/event.ts`** :

- Textes (`eventName`, `welcomeMessage`, `celebrationText`)
- Durées (`spotlightDurationMs`, `reactionCooldownMs`)
- Emojis de réaction (`DEFAULT_REACTION_EMOJIS` — partagé avec `server/db.ts`)
- Couleurs (`theme`) → synchronisées en CSS variables via `EventThemeProvider`
- Feature flags (`features`)

Modifier `eventConfig` suffit pour adapter l'app sans toucher aux pages.

## Pattern PhotoService (modèle pour nouvelles features)

Pour toute fonctionnalité avec stockage backend :

1. Définir une **interface** TypeScript (`PhotoService`, `PrivateMessages`…)
2. Implémenter **local** (Express + JSON/fichiers) et **Supabase** si besoin
3. Choisir l'implémentation via `NEXT_PUBLIC_BACKEND` (`local` | `supabase`)
4. **Ne pas mélanger** public et privé (ex. messages privés ≠ mur public)

Les pages consomment l'interface, jamais le serveur directement (sauf cas admin/upload multipart).

## Ajouter une nouvelle feature

1. **Flag** — ajouter un booléen dans `FeatureFlags` (`src/config/event.ts`), `false` par défaut si non implémenté
2. **Page / module** — créer la route ou le composant
3. **Config** — lire `eventConfig` (textes, durées, flags) au lieu de constantes en dur
4. **Stockage** — si données persistées : interface + impl local/Supabase, routes Express dédiées, dossier `data/` séparé si confidentialité différente
5. **CSS** — ajouter de **nouveaux** keyframes/classes ; ne pas modifier les animations existantes (voir ci-dessous)
6. **Doc** — mettre à jour ce fichier et `.env.local.example` si nouvelles variables

## Thème visuel

- Variables CSS dans `globals.css` : `--event-gradient-from/via/to`, `--event-accent`, etc.
- Classe utilitaire `.event-gradient-bg` pour le fond dégradé
- `EventThemeProvider` (dans `layout.tsx`) applique `eventConfig.theme` au chargement
- Si `features.timeBasedTheme === true`, `timeTheme.ts` met à jour les variables selon l'heure

Pour changer le thème dynamiquement :

```ts
document.documentElement.style.setProperty("--event-gradient-from", "#…");
```

## Feature flags (défaut = tout activé sauf mention)

| Flag | Usage actuel |
|------|----------------|
| `reactions` | Boutons emoji sur `/wall` |
| `confetti` | ConfettiBackground sur `/`, `/wall`, `/countdown` |
| `spotlight` | Plein écran 10s pour nouvelles photos |
| `countdown` | Type prévu ; page `/countdown` existe |
| `retrospective` | Type prévu ; page `/retrospective` existe |
| `privateMessages` | Lien `/message` + onglet admin |
| `qrPage` | Type prévu ; page `/qr` existe |
| `timeBasedTheme` | Palette horaire sur le mur |
| `adminBulkActions` | Sélection / export ZIP / suppression masse |

## Fichiers sensibles — ne pas casser

| Fichier | Pourquoi |
|---------|----------|
| `src/app/globals.css` | Keyframes existants : `photo-pop-in`, `spotlight-pop-in`, `reaction-float`, `confetti-fall`, `celebration-pop`, `celebration-pulse`, `pulse-soft` — **ne pas modifier**, seulement ajouter |
| `server/db.ts` | `REACTION_EMOJIS` importé depuis `src/config/event.ts` ; migration `reactions` sur anciennes lignes JSON |
| `data/event-config.json` | Config événement (surcharge `src/config/event.ts`) via `GET/PUT /api/config` |
| `NEXT_PUBLIC_SERVER_URL` | URL du laptop Express ; les téléphones doivent joindre cette IP en soirée (pas `localhost`) |
| `data/photos.json` + `data/uploads/` | Mur public uniquement |
| `data/private-messages.json` + `data/private-uploads/` | Jamais exposés via `/uploads` ni `GET /api/photos` |

## Modes backend

- **local** : `npm run dev:all` — Next + Express (`server/index.ts`), Socket.io temps réel
- **supabase** : `NEXT_PUBLIC_BACKEND=supabase` — PhotoService Supabase ; messages privés à finaliser (RLS, signed URLs)

## Scripts utiles

```bash
npm run dev:all    # Développement (Next + Express)
npm run build      # Build production Next
npm run start:prod # Docker / VPS
```
