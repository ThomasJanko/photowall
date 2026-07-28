/**
 * Test de charge Socket.io — simulation d'écrans / murs photo.
 *
 * Protocole réel Engine.IO v4 + Socket.io v4 (transport websocket only),
 * contre le serveur Express du projet (server/index.ts).
 *
 * Usage :
 *   k6 run -e SCENARIO=normal tests/load/websocket/websocket-test.js
 *   k6 run -e SCENARIO=stress -e SERVER_URL=http://10.0.0.66:4000 tests/load/websocket/websocket-test.js
 */

import ws from "k6/ws";
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend, Gauge } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.4/index.js";
import crypto from "k6/crypto";
import exec from "k6/execution";

const config = require("./config.js");

export const options = config.buildOptions();

// --- Métriques custom ---
const websocketConnections = new Rate("websocket_connections");
const websocketMessagesReceived = new Counter("websocket_messages_received");
const websocketErrors = new Counter("websocket_errors");
const websocketMessageSize = new Trend("websocket_message_size");
const websocketLatency = new Trend("websocket_latency", true);
const websocketReconnects = new Counter("websocket_reconnects");
const websocketActive = new Gauge("websocket_active_connections");
const markersPublished = new Counter("websocket_markers_published");
const markersReceived = new Counter("websocket_markers_received");
const messageDelivery = new Rate("websocket_message_delivery");

const MARKER_RE = /^\[k6\]:([a-zA-Z0-9_-]+)$/;

function toWsBase(httpUrl) {
  if (httpUrl.startsWith("https://")) return "wss://" + httpUrl.slice(8);
  if (httpUrl.startsWith("http://")) return "ws://" + httpUrl.slice(7);
  if (httpUrl.startsWith("ws://") || httpUrl.startsWith("wss://")) return httpUrl;
  return "ws://" + httpUrl;
}

function socketIoUrl() {
  return `${toWsBase(config.SERVER_URL)}/socket.io/?EIO=4&transport=websocket`;
}

function adminToken() {
  return crypto.sha256(`mur-admin:${config.ADMIN_CODE}`, "hex");
}

function parseSocketIoEvent(raw) {
  if (!raw.startsWith("42")) return null;
  try {
    const parsed = JSON.parse(raw.slice(2));
    if (!Array.isArray(parsed) || parsed.length < 1) return null;
    return { event: String(parsed[0]), data: parsed[1], raw };
  } catch {
    return null;
  }
}

function isMarkerAnnouncement(event, data) {
  if (event !== "announcement:new" || !data || typeof data !== "object") {
    return false;
  }
  const text = typeof data.text === "string" ? data.text.trim() : "";
  return MARKER_RE.test(text);
}

function markerIdFromAnnouncement(data) {
  const m = String(data.text || "")
    .trim()
    .match(MARKER_RE);
  return m ? m[1] : null;
}

function recordPayloadLatency(payload) {
  if (!payload || typeof payload !== "object") return;
  const ts = payload.startedAt || payload.createdAt;
  if (typeof ts !== "number" || ts <= 0) return;
  const lag = Date.now() - ts;
  if (lag >= 0 && lag < 60000) websocketLatency.add(lag);
}

function estimateScenarioMs() {
  const d = config.selected.duration;
  const m = String(d).match(/^(\d+)(s|m|h)$/);
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  if (m[2] === "s") return n * 1000;
  if (m[2] === "m") return n * 60 * 1000;
  return n * 3600 * 1000;
}

/**
 * Session Socket.io persistante jusqu'à deadlineMs.
 * Gère ping/pong Engine.IO, handshake Socket.io, fermeture propre.
 * ws.connect() bloque jusqu'à la fermeture du socket.
 */
function openSocketSession(deadlineMs, hooks) {
  const url = socketIoUrl();
  let connected = false;
  let intentionalClose = false;
  let pingInterval = 25000;
  let lastActivityAt = Date.now();

  const res = ws.connect(
    url,
    { tags: { scenario: config.SCENARIO } },
    function (socket) {
      websocketActive.add(1);

      socket.on("message", function (message) {
        if (typeof message !== "string") {
          websocketErrors.add(1);
          return;
        }

        lastActivityAt = Date.now();
        websocketMessageSize.add(message.length);

        // Engine.IO open
        if (message.startsWith("0")) {
          try {
            const open = JSON.parse(message.slice(1));
            if (open.pingInterval) pingInterval = open.pingInterval;
          } catch (_) {
            /* continue handshake */
          }
          socket.send("40");
          return;
        }

        // Engine.IO ping → pong
        if (message === "2") {
          socket.send("3");
          return;
        }

        // Engine.IO close
        if (message === "1") {
          websocketErrors.add(1);
          intentionalClose = true;
          socket.close();
          return;
        }

        // Socket.io CONNECT ack (namespace /)
        if (message.startsWith("40") && !message.startsWith("42")) {
          connected = true;
          websocketConnections.add(1);
          if (hooks && hooks.onReady) hooks.onReady(socket);
          return;
        }

        // Socket.io CONNECT_ERROR / DISCONNECT
        if (message.startsWith("44") || message.startsWith("41")) {
          websocketErrors.add(1);
          websocketConnections.add(0);
          intentionalClose = true;
          socket.close();
          return;
        }

        if (!message.startsWith("42")) return;

        const evt = parseSocketIoEvent(message);
        if (!evt) {
          websocketErrors.add(1);
          return;
        }

        websocketMessagesReceived.add(1);
        recordPayloadLatency(evt.data);

        if (hooks && hooks.onEvent) hooks.onEvent(evt, socket);
      });

      socket.on("error", function () {
        websocketErrors.add(1);
        websocketConnections.add(0);
      });

      socket.on("close", function () {
        websocketActive.add(-1);
        if (!intentionalClose && connected) {
          websocketConnections.add(0);
        }
      });

      socket.setInterval(function () {
        if (Date.now() >= deadlineMs) {
          intentionalClose = true;
          socket.close();
          return;
        }
        if (
          connected &&
          Date.now() - lastActivityAt > pingInterval * 2 + config.CONNECT_TIMEOUT
        ) {
          websocketErrors.add(1);
          intentionalClose = false;
          socket.close();
        }
      }, 1000);

      if (hooks && hooks.attach) {
        hooks.attach(socket, function isReady() {
          return connected;
        }, function closeClean() {
          intentionalClose = true;
          socket.close();
        });
      }
    }
  );

  const ok = check(res, {
    "websocket status 101": (r) => r && r.status === 101,
  });

  if (!ok) {
    websocketConnections.add(0);
    websocketErrors.add(1);
  }

  return { ok, connected };
}

/**
 * VU écran : connexion persistante + reconnexion auto jusqu'à la fin du scénario.
 */
export function screenClient() {
  const deadline = Date.now() + estimateScenarioMs();
  let reconnects = 0;

  while (Date.now() < deadline && reconnects <= config.MAX_RECONNECTS) {
    const remaining = deadline - Date.now();
    if (remaining < 1000) break;

    const result = openSocketSession(deadline, {
      onEvent: function (evt) {
        if (!isMarkerAnnouncement(evt.event, evt.data)) return;
        markersReceived.add(1);
        recordPayloadLatency(evt.data);
      },
    });

    if (Date.now() >= deadline) break;

    // Déconnexion avant la fin → reconnexion
    reconnects += 1;
    websocketReconnects.add(1);

    if (!result.ok) {
      sleep(config.RECONNECT_DELAY / 1000);
      continue;
    }

    sleep(config.RECONNECT_DELAY / 1000);
  }

  if (reconnects > config.MAX_RECONNECTS) {
    websocketErrors.add(1);
    check(null, { "max reconnects not exceeded": () => false });
  }
}

/**
 * VU publisher : émet des announcement:new marqueurs via l'API admin réelle.
 * Mesure la livraison (echo sur sa propre socket) et la latence.
 * durationMs=1 pour limiter l'impact UI sur les murs réels.
 */
export function publishMarkers() {
  // Laisse le temps aux listeners d'établir leurs sockets
  sleep(10);

  const token = adminToken();
  const deadline = Date.now() + estimateScenarioMs() - 12000;
  let seq = 0;

  while (Date.now() < deadline) {
    const cycleStart = Date.now();
    seq += 1;
    const markerId = `${exec.vu.idInTest}-${seq}-${Date.now()}`;
    const text = `${config.MARKER_PREFIX}:${markerId}`;
    let delivered = false;
    let settled = false;

    const sessionEnd = Date.now() + config.MARKER_WAIT + 3000;

    openSocketSession(sessionEnd, {
      attach: function (socket, isReady, closeClean) {
        socket.setTimeout(function () {
          if (!isReady()) {
            websocketErrors.add(1);
            if (!settled) {
              settled = true;
              messageDelivery.add(0);
            }
            closeClean();
            return;
          }

          const res = http.post(
            `${config.SERVER_URL}/api/announcement`,
            JSON.stringify({
              text,
              durationMs: 1,
            }),
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              timeout: `${config.CONNECT_TIMEOUT}ms`,
              tags: { name: "publish_marker" },
            }
          );

          const published = check(res, {
            "publish marker 200": (r) => r.status === 200,
          });

          if (published) {
            markersPublished.add(1);
          } else {
            websocketErrors.add(1);
            if (!settled) {
              settled = true;
              messageDelivery.add(0);
            }
            closeClean();
          }
        }, 400);

        socket.setTimeout(function () {
          if (!settled) {
            settled = true;
            messageDelivery.add(delivered ? 1 : 0);
          }
          closeClean();
        }, config.MARKER_WAIT + 1200);
      },
      onEvent: function (evt, socket) {
        if (!isMarkerAnnouncement(evt.event, evt.data)) return;
        const id = markerIdFromAnnouncement(evt.data);
        if (id !== markerId) return;

        delivered = true;
        if (!settled) {
          settled = true;
          messageDelivery.add(1);
        }
        recordPayloadLatency(evt.data);
        // Ne pas compter dans markersReceived : réservé aux VUs listeners (fan-out)
      },
    });

    const elapsed = Date.now() - cycleStart;
    const waitMs = Math.max(0, config.PUBLISH_INTERVAL - elapsed);
    if (waitMs > 0 && Date.now() < deadline) {
      sleep(waitMs / 1000);
    }
  }
}

export function handleSummary(data) {
  const published =
    (data.metrics.websocket_markers_published &&
      data.metrics.websocket_markers_published.values.count) ||
    0;
  const received =
    (data.metrics.websocket_markers_received &&
      data.metrics.websocket_markers_received.values.count) ||
    0;
  const listeners = config.selected.listeners;
  const expectedFanout = published * listeners;
  const fanoutLoss =
    expectedFanout > 0 ? Math.max(0, 1 - received / expectedFanout) : 0;

  const extra = [
    "",
    "=== Fan-out markers (écrans) ===",
    `SCENARIO:              ${config.SCENARIO}`,
    `SERVER_URL:            ${config.SERVER_URL}`,
    `Listeners configurés:  ${listeners}`,
    `Markers publiés:       ${published}`,
    `Réceptions (listeners):${received}`,
    `Attendu (~pub×VU):     ${expectedFanout}`,
    `Perte fan-out estimée: ${(fanoutLoss * 100).toFixed(2)}%`,
    `Seuil min réceptions:  ${config.minMarkerReceived}`,
    `Publisher actif:       ${config.ENABLE_PUBLISHER}`,
    "",
  ].join("\n");

  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }) + extra,
    "summary-websocket.json": JSON.stringify(
      {
        scenario: config.SCENARIO,
        serverUrl: config.SERVER_URL,
        listeners,
        published,
        received,
        expectedFanout,
        fanoutLoss,
        metrics: data.metrics,
      },
      null,
      2
    ),
  };
}
