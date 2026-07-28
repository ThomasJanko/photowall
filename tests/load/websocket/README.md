# Tests de charge WebSocket (Socket.io)

Simulation d'écrans / murs photo connectés en temps réel contre le **vrai** serveur Express + Socket.io du projet (`app/server/index.ts`).

> Ce n'est pas du WebSocket brut : les clients réels utilisent **Socket.io v4**.  
> Le test reproduite le handshake Engine.IO (`EIO=4`, transport `websocket` uniquement).

## Architecture testée

| Élément | Valeur |
|--------|--------|
| Serveur | Express + Socket.io (`SERVER_PORT`, défaut `4000`) |
| URL | `SERVER_URL` / `NEXT_PUBLIC_SERVER_URL` (ex. `http://10.0.0.66:4000`) |
| Endpoint | `ws(s)://<host>/socket.io/?EIO=4&transport=websocket` |
| Auth socket | Aucune (comme les vrais écrans) |
| Rooms / wall ID | Aucun — broadcast global |
| Client simulé | Page `/screen` / `/wall` via `LocalPhotoService` |

Événements observés : `photo:*`, `announcement:new`, `screen:command`, `poll:*`, `timeline:*`, `planning:*`, `message:new`.

## Prérequis

### 1. Installer k6

**Windows (winget) :**

```bash
winget install GrafanaLabs.k6 --accept-package-agreements
```

**Windows (chocolatey) :**

```bash
choco install k6
```

**macOS :**

```bash
brew install k6
```

**Linux :** voir https://grafana.com/docs/k6/latest/set-up/install-k6/

Vérifier :

```bash
k6 version
```

### 2. Démarrer le serveur photo

Depuis `app/` :

```bash
npm run server
```

Ou la stack complète :

```bash
npm run dev:all
```

Le serveur doit être joignable à l'URL configurée (ex. `http://10.0.0.66:4000`).

## Configuration

Fichier : `config.js` — surcharge via `-e` :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `SERVER_URL` | `http://10.0.0.66:4000` | Base HTTP du serveur Express |
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

`SERVER_URL` peut aussi être passé via `NEXT_PUBLIC_SERVER_URL`.

## Scénarios

| Scénario | Clients (VU) | Durée | Profil |
|----------|--------------|-------|--------|
| `smoke` | 10 | 5 min | Sanity check |
| `normal` | 50 | 15 min | Charge nominale |
| `stress` | 80 | 30 min | Stress cible (60–80 écrans) |
| `spike` | 0 → 100 | ~10 min | Montée rapide |

## Lancement

Depuis la **racine du repo** :

```bash
k6 run -e SCENARIO=smoke tests/load/websocket/websocket-test.js
k6 run -e SCENARIO=normal tests/load/websocket/websocket-test.js
k6 run -e SCENARIO=stress tests/load/websocket/websocket-test.js
k6 run -e SCENARIO=spike tests/load/websocket/websocket-test.js
```

Avec URL explicite :

```bash
k6 run -e SCENARIO=normal -e SERVER_URL=http://10.0.0.66:4000 tests/load/websocket/websocket-test.js
```

Via npm (depuis `app/`, scénario `normal`) :

```bash
npm run test:load:websocket
```

### Publisher désactivé (soirée / murs réels)

Le publisher envoie des annonces `[k6]:...` avec `durationMs: 1` (flash minimal). Pour un test **écoute seule** sans toucher l'UI :

```bash
k6 run -e SCENARIO=normal -e ENABLE_PUBLISHER=false tests/load/websocket/websocket-test.js
```

Sans publisher, les seuils de perte de messages / fan-out sont désactivés.

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
- fan-out listeners insuffisant (`websocket_markers_received` sous le minimum estimé ≈ publishes × VUs × 0.98)

Un résumé fan-out est aussi affiché en fin de run + fichier `summary-websocket.json` (cwd).

## Interprétation des résultats

1. **`websocket_connections`** bas → serveur saturé, firewall, mauvaise `SERVER_URL`, ou Socket.io down.
2. **`websocket_latency`** élevé → CPU/event-loop Express, réseau Wi‑Fi, ou GC Node.
3. **`websocket_errors` / reconnects** → instabilité réseau ou crash serveur sous charge.
4. **Perte fan-out** → certains écrans ne reçoivent pas les broadcasts (adapter / mémoire / backpressure).
5. **`websocket_message_size`** → utile si un jour des payloads grossissent (éviter le base64 sur le socket).

Sous charge, surveiller aussi la machine serveur : CPU, RAM, handles, bande passante.

## Monter la charge progressivement

1. `SCENARIO=smoke` — valider le handshake et l'URL.
2. `normal` (50) — baseline nominale.
3. `stress` (80) — cible soirée.
4. `spike` (100) — pic brutal.
5. Au-delà : modifier `config.js` (`listeners`) ou :

```bash
k6 run -e SCENARIO=stress tests/load/websocket/websocket-test.js --vus 120 --duration 10m
```

> `--vus` / `--duration` peuvent entrer en conflit avec les `scenarios` du script. Préférer adapter `config.js` pour des profils custom.

## Export Grafana / InfluxDB

### InfluxDB (k6 `--out`)

```bash
k6 run -e SCENARIO=normal --out influxdb=http://localhost:8086/k6 tests/load/websocket/websocket-test.js
```

Variables utiles : `K6_INFLUXDB_ORGANIZATION`, `K6_INFLUXDB_BUCKET`, `K6_INFLUXDB_TOKEN` (InfluxDB v2).

### Prometheus (remote write, k6 récent)

```bash
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  k6 run -o experimental-prometheus-rw -e SCENARIO=normal tests/load/websocket/websocket-test.js
```

Importer ensuite un dashboard k6 Grafana (ex. ID 2587 ou équivalent Prometheus).

### JSON summary local

Chaque run écrit `summary-websocket.json` dans le répertoire courant.

## Fichiers

```
tests/load/websocket/
  config.js           # profils, seuils, env
  websocket-test.js   # scénario k6 + protocole Socket.io
  README.md           # cette doc
```

## Notes importantes

- Aucun mock / faux endpoint : handshake réel + API `POST /api/announcement` (admin) pour les marqueurs.
- Le token admin est dérivé comme en prod : `sha256("mur-admin:" + ADMIN_CODE)`.
- Pendant un test avec publisher, des annonces `[k6]:...` très courtes peuvent apparaître sur les murs.
- Les images ne transitent **pas** en base64 sur le socket (seulement métadonnées JSON + URL `/uploads/...`).
