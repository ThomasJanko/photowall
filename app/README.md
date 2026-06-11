# Mur de souvenirs — App anniversaire

App web : les invités envoient des photos depuis leur téléphone, elles
s'affichent en temps réel sur un écran/projecteur.

Voir `../PROJET.md` pour le contexte complet, l'architecture et le plan de dev.

## Installation

```bash
npm install
cp .env.local.example .env.local
```

## Lancer en local (mode par défaut, sans internet)

Deux process : le serveur Next.js (front) et le serveur Express (API +
websocket + stockage photos).

```bash
npm run dev:all
```

- Front : http://localhost:3000
- API/serveur photos : http://localhost:4000
- Photos stockées dans `data/uploads/`, métadonnées dans `data/photos.json`

### Pages

- `/` — page invité (mobile) : prendre/choisir une photo, compression auto, envoi
- `/wall` — mur projeté en temps réel (plein écran sur le PC branché au projecteur)
- `/admin` — modération (masquer une photo)

## Accès depuis les téléphones (réseau local, jour J)

1. Connecter le laptop et les téléphones au même réseau wifi (routeur portable
   ou hotspot).
2. Trouver l'IP locale du laptop (`ipconfig` sur Windows, chercher l'adresse
   IPv4 du wifi, ex: `192.168.1.50`).
3. Mettre à jour `.env.local` :
   ```
   NEXT_PUBLIC_SERVER_URL=http://192.168.1.50:4000
   ```
4. Relancer `npm run dev:all`.
5. Générer le QR code d'accès :
   ```bash
   npx tsx scripts/generate-qr.ts http://192.168.1.50:3000
   ```
   → génère `qrcode-acces.png` à imprimer/afficher.

## Mode "online" (Supabase)

Voir les commentaires en tête de `src/lib/supabasePhotoService.ts` pour le
setup (bucket Storage, table Postgres, Realtime). Une fois configuré :

```
NEXT_PUBLIC_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Dans ce mode, pas besoin de lancer `npm run server` (pas de backend local) —
juste `npm run dev` et déploiement sur Vercel.

## Déploiement Docker (VPS)

Pour un déploiement sur VPS avec persistance des photos (volume Docker) :

```bash
cp .env.docker.example .env
# Éditer .env avec l'IP/domaine public du VPS
docker compose up -d --build
```

Guide complet : [DOCKER.md](./DOCKER.md)
