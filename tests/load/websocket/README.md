# Tests de charge WebSocket (Socket.io)

Simulation d'écrans / murs photo connectés en temps réel contre le **vrai** serveur Express + Socket.io du projet (`server/index.ts`).

> Ce n'est pas du WebSocket brut : les clients réels utilisent **Socket.io v4**.  
> Le test reproduite le handshake Engine.IO (`EIO=4`, transport `websocket` uniquement).

## Architecture testée

| Élément | Valeur |
|--------|--------|
| Serveur | Express + Socket.io (`SERVER_PORT`, défaut `4000`) |
| URL | `SERVER_URL` / `NEXT_PUBLIC_SERVER_URL` (défaut `http://127.0.0.1:4000`) |
| Endpoint | `ws(s)://<host>/socket.io/?EIO=4&transport=websocket` |
| Auth socket | Aucune (comme les vrais écrans) |
| Rooms / wall ID | Aucun — broadcast global |
| Client simulé | Page `/screen` / `/wall` via `LocalPhotoService` |

Événements observés : `photo:*`, `announcement:new`, `screen:command`, `poll:*`, `timeline:*`, `planning:*`, `message:new`.

## Prérequis

### Option A — Dans Docker (recommandé)

k6 est **embarqué** dans l'image applicative. Aucune install locale.

```bash
docker compose up -d --build
docker compose exec app npm run test:load:websocket
```

### Option B — Local

**Windows (winget) :**

```bash
winget install GrafanaLabs.k6 --accept-package-agreements
```

**macOS :**

```bash
brew install k6
```

**Linux :** https://grafana.com/docs/k6/latest/set-up/install-k6/

Démarrer le serveur :

```bash
npm run server
# ou
npm run dev:all
```

## Configuration

Fichier : `config.js` — surcharge via `-e` :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `SERVER_URL` | `http://127.0.0.1:4000` | Base HTTP du serveur Express |
| `SCENARIO` | `normal` | `smoke` \| `normal` \| `stress` \| `spike` |
| `ADMIN_CODE` | `admin` | Code admin (publisher de marqueurs) |
| `ENABLE_PUBLISHER` | `true` | Émet des `announcement:new` de test |
| `CONNECT_TIMEOUT` | `10000` | Timeout handshake (ms) |
| `RECONNECT_DELAY` | `2000` | Délai avant reconnexion (ms) |
| `MAX_RECONNECTS` | `20` | Max reconnexions par VU |
| `PUBLISH_INTERVAL` | `5000` | Intervalle entre marqueurs (ms) |
| `MARKER_WAIT` | `2000` | Timeout livraison d'un marqueur (ms) |
| `VUS` | (selon scénario) | Override du nombre de listeners |
| `DURATION` | (selon scénario) | Override durée (`30s`, `5m`, …) |

## Scénarios

| Scénario | Clients (VU) | Durée | Profil |
|----------|--------------|-------|--------|
| `smoke` | 10 | 5 min | Sanity check |
| `normal` | 50 | 15 min | Charge nominale |
| `stress` | 80 | 30 min | Stress cible (60–80 écrans) |
| `spike` | 0 → 100 | ~10 min | Montée rapide |

## Lancement

### Depuis la racine du repo

```bash
k6 run -e SCENARIO=smoke tests/load/websocket/websocket-test.js
k6 run -e SCENARIO=normal tests/load/websocket/websocket-test.js
k6 run -e SCENARIO=stress tests/load/websocket/websocket-test.js
k6 run -e SCENARIO=spike tests/load/websocket/websocket-test.js

npm run test:load:websocket
```

### Depuis Docker

```bash
docker compose exec app npm run test:load:websocket

docker compose exec app k6 run \
  -e SCENARIO=stress \
  -e SERVER_URL=http://127.0.0.1:4000 \
  -e ADMIN_CODE=change-moi \
  tests/load/websocket/websocket-test.js
```

> Dans le conteneur, pointe toujours vers `http://127.0.0.1:4000` (Express local au conteneur).  
> Utilise le même `ADMIN_CODE` que celui du `.env` Docker si le publisher est actif.

### Publisher désactivé (soirée / murs réels)

```bash
k6 run -e SCENARIO=normal -e ENABLE_PUBLISHER=false tests/load/websocket/websocket-test.js
```

## Métriques

| Métrique | Type | Signification |
|----------|------|----------------|
| `websocket_connections` | Rate | Succès du handshake Socket.io |
| `websocket_messages_received` | Counter | Events Socket.io `42[...]` reçus |
| `websocket_errors` | Counter | Erreurs protocole / réseau / publish |
| `websocket_message_size` | Trend | Taille des frames (bytes) |
| `websocket_latency` | Trend | `now - startedAt/createdAt` (ms) |
| `websocket_message_delivery` | Rate | Echo marqueur reçu par le publisher |
| `websocket_markers_published` | Counter | Marqueurs HTTP émis |
| `websocket_markers_received` | Counter | Marqueurs reçus par les **listeners** |
| `websocket_reconnects` | Counter | Reconnexions |
| `websocket_active_connections` | Gauge | Connexions ouvertes à l'instant T |

## Seuils (échec du test)

Le run échoue si :

- plus de ~1 % de handshakes échouent (`websocket_connections rate ≤ 0.99`)
- latence moyenne > 500 ms (`websocket_latency avg`)
- erreurs WebSocket / publish (`websocket_errors count > 0`)
- livraison echo marqueur < 98 % (`websocket_message_delivery`)
- fan-out listeners insuffisant (`websocket_markers_received` sous le minimum estimé)

Un résumé fan-out est aussi affiché en fin de run + fichier `summary-websocket.json` (cwd).

## Interprétation des résultats

1. **`websocket_connections`** bas → serveur saturé, firewall, mauvaise `SERVER_URL`, ou Socket.io down.
2. **`websocket_latency`** élevé → CPU/event-loop Express, réseau Wi‑Fi, ou GC Node.
3. **`websocket_errors` / reconnects** → instabilité réseau ou crash serveur sous charge.
4. **Perte fan-out** → certains écrans ne reçoivent pas les broadcasts.
5. **`websocket_message_size`** → utile si les payloads grossissent.

## Monter la charge progressivement

1. `SCENARIO=smoke` — valider le handshake et l'URL.
2. `normal` (50) — baseline nominale.
3. `stress` (80) — cible soirée.
4. `spike` (100) — pic brutal.
5. Overrides rapides : `-e VUS=120 -e DURATION=10m`

## Export Grafana / InfluxDB

```bash
k6 run -e SCENARIO=normal --out influxdb=http://localhost:8086/k6 tests/load/websocket/websocket-test.js
```

```bash
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  k6 run -o experimental-prometheus-rw -e SCENARIO=normal tests/load/websocket/websocket-test.js
```

## Fichiers

```
tests/load/websocket/
  config.js           # profils, seuils, env
  websocket-test.js   # scénario k6 + protocole Socket.io
  README.md           # cette doc
```

## Notes

- Aucun mock : handshake réel + API `POST /api/announcement` (admin) pour les marqueurs.
- Token admin : `sha256("mur-admin:" + ADMIN_CODE)`.
- Les images ne transitent **pas** en base64 sur le socket.
