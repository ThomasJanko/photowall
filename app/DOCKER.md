# Déploiement Docker (VPS)

Mur de photos — un conteneur unique lance **Next.js** (port 3000) et **Express +
Socket.io** (port 4000). Les données (`photos.json` + `data/uploads/`) sont
persistées dans un volume Docker.

Le dev local (`npm run dev:all`) reste inchangé — Docker est réservé à la prod.

## Prérequis

- Docker + Docker Compose v2 sur le VPS
- Ports 3000 et 4000 ouverts (ou reverse proxy devant)

## Configuration

1. Copier le fichier d'exemple :

```bash
cp .env.docker.example .env
```

2. Éditer `.env` avec l'**IP ou le domaine public** du VPS :

```env
NEXT_PUBLIC_APP_URL=http://203.0.113.10:3000
NEXT_PUBLIC_SERVER_URL=http://203.0.113.10:4000
NEXT_PUBLIC_BACKEND=local
```

> **Important — variables `NEXT_PUBLIC_*`**  
> Next.js les compile **au moment du build** de l'image, pas au runtime.  
> Si tu changes une URL publique, il faut **reconstruire** l'image :
> `docker compose build --no-cache && docker compose up -d`

Les variables `SERVER_PORT` et `PORT` sont lues au **runtime** par le serveur
Express et Next.js.

## Build et lancement

```bash
docker compose build
docker compose up -d
```

- Front : `http://<vps>:3000`
- API photos : `http://<vps>:4000`
- QR code : `http://<vps>:3000/qr`

Logs :

```bash
docker compose logs -f
```

Arrêt :

```bash
docker compose down
```

## Persistance des données

Volume nommé `app-data`, monté sur `/app/data` dans le conteneur :

| Fichier / dossier      | Contenu                          |
|------------------------|----------------------------------|
| `data/photos.json`     | Métadonnées des photos           |
| `data/uploads/`        | Fichiers images uploadés         |

Les photos **survivent** à un `docker compose down` ou un rebuild de l'image.

Sauvegarde manuelle :

```bash
docker compose run --rm app tar czf - -C /app/data . > backup-data.tar.gz
```

Restauration (conteneur arrêté) :

```bash
docker run --rm -v app_app-data:/data -v $(pwd):/backup alpine \
  sh -c "cd /data && tar xzf /backup/backup-data.tar.gz"
```

## Changer de mode (local / Supabase)

1. Modifier `.env` :

```env
NEXT_PUBLIC_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

2. Reconstruire (obligatoire pour `NEXT_PUBLIC_*`) :

```bash
docker compose build --no-cache
docker compose up -d
```

En mode Supabase, le serveur Express tourne toujours dans le conteneur mais
n'est pas utilisé par le front — seul Next.js sert les pages.

## Mise à jour (sans perdre les photos)

```bash
git pull
docker compose build
docker compose up -d
```

Le volume `app-data` n'est **pas** touché par un rebuild.

## Architecture

```
┌─────────────────────────────────────┐
│  Conteneur (node:20-alpine)         │
│  scripts/start-prod.sh              │
│    ├─ next start      :3000         │
│    └─ tsx server/...  :4000         │
│  volume app-data → /app/data        │
└─────────────────────────────────────┘
```

Un seul conteneur plutôt que deux services : le front et l'API partagent
nativement le dossier `data/`, sans configuration réseau inter-containers.

## Dépannage

| Problème | Piste |
|----------|-------|
| Photos ne s'affichent pas sur téléphone | Vérifier `NEXT_PUBLIC_SERVER_URL` (IP publique, pas `localhost`) puis rebuild |
| Upload échoue | Port 4000 ouvert ? Pare-feu VPS ? |
| Conteneur unhealthy | `docker compose logs app` — attendre ~40s au premier démarrage |
| Données perdues | Vérifier que le volume existe : `docker volume ls` |

## Script npm équivalent (hors Docker)

Pour tester la prod en local sans Docker :

```bash
npm run build
npm run start:prod
```

(Nécessite `tsx` en devDependencies, déjà installé.)
