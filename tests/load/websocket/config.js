/**
 * Configuration centralisée des tests de charge Socket.io.
 *
 * Variables d'environnement (k6 -e KEY=value) :
 *   SERVER_URL       Base HTTP du serveur Express (défaut: http://10.0.0.66:4000)
 *   SCENARIO         smoke | normal | stress | spike (défaut: normal)
 *   ADMIN_CODE       Code admin pour le publisher (défaut: admin)
 *   ENABLE_PUBLISHER true|false — émet des marqueurs announcement:new (défaut: true)
 *   CONNECT_TIMEOUT  ms timeout handshake (défaut: 10000)
 *   RECONNECT_DELAY  ms entre reconnexions (défaut: 2000)
 *   MAX_RECONNECTS   max tentatives par session (défaut: 20)
 *   PUBLISH_INTERVAL ms entre marqueurs (défaut: 5000)
 *   MARKER_WAIT      ms max pour recevoir un marqueur (latence) (défaut: 2000)
 */

const SCENARIO = (__ENV.SCENARIO || "normal").toLowerCase();

const SCENARIOS = {
  smoke: {
    name: "smoke",
    listeners: 10,
    duration: "5m",
    description: "Sanity check — 10 écrans, 5 minutes",
  },
  normal: {
    name: "normal",
    listeners: 50,
    duration: "15m",
    description: "Charge nominale — 50 écrans, 15 minutes",
  },
  stress: {
    name: "stress",
    listeners: 80,
    duration: "5m",
    description: "Stress — 80 écrans, 30 minutes",
  },
  spike: {
    name: "spike",
    listeners: 100,
    duration: "10m",
    description: "Spike — montée rapide 0 → 100 écrans",
    ramp: true,
  },
};

if (!SCENARIOS[SCENARIO]) {
  throw new Error(
    `SCENARIO inconnu: "${SCENARIO}". Valeurs: smoke, normal, stress, spike`
  );
}

const selected = Object.assign({}, SCENARIOS[SCENARIO]);

// Overrides optionnels pour itérer rapidement (ex: -e DURATION=30s -e VUS=5)
if (__ENV.VUS) {
  selected.listeners = Number(__ENV.VUS);
}
if (__ENV.DURATION) {
  selected.duration = __ENV.DURATION;
}

const SERVER_URL = (
  __ENV.SERVER_URL ||
  __ENV.NEXT_PUBLIC_SERVER_URL ||
  "http://127.0.0.1:4000"
).replace(/\/$/, "");

const ENABLE_PUBLISHER = (__ENV.ENABLE_PUBLISHER || "true").toLowerCase() !== "false";

function parseDurationToSeconds(duration) {
  const m = String(duration).match(/^(\d+)(s|m|h)$/);
  if (!m) return 60;
  const n = Number(m[1]);
  if (m[2] === "s") return n;
  if (m[2] === "m") return n * 60;
  return n * 3600;
}

const durationSec = parseDurationToSeconds(selected.duration);
const publishIntervalMs = Number(__ENV.PUBLISH_INTERVAL || 5000);
const estimatedPublishes = ENABLE_PUBLISHER
  ? Math.max(1, Math.floor((durationSec - 15) / (publishIntervalMs / 1000)))
  : 0;
const minMarkerReceived = ENABLE_PUBLISHER
  ? Math.floor(estimatedPublishes * selected.listeners * 0.98)
  : 0;

/** Options k6 exportées par websocket-test.js */
function buildOptions() {
  const thresholds = {
    websocket_errors: ["count==0"],
    websocket_connections: ["rate>0.99"],
    websocket_latency: ["avg<500", "p(95)<1000"],
    checks: ["rate>0.99"],
  };

  if (ENABLE_PUBLISHER && minMarkerReceived > 0) {
    thresholds.websocket_message_delivery = ["rate>0.98"];
    thresholds.websocket_markers_received = [`count>=${minMarkerReceived}`];
  }

  const scenarios = {};

  if (selected.ramp) {
    scenarios.listeners = {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: selected.listeners },
        { duration: "8m", target: selected.listeners },
        { duration: "90s", target: 0 },
      ],
      gracefulRampDown: "30s",
      exec: "screenClient",
    };
  } else {
    scenarios.listeners = {
      executor: "constant-vus",
      vus: selected.listeners,
      duration: selected.duration,
      gracefulStop: "30s",
      exec: "screenClient",
    };
  }

  if (ENABLE_PUBLISHER) {
    scenarios.publisher = {
      executor: "constant-vus",
      vus: 1,
      duration: selected.ramp ? "9m" : selected.duration,
      gracefulStop: "10s",
      exec: "publishMarkers",
    };
  }

  return {
    scenarios,
    thresholds,
    summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  };
}

module.exports = {
  SCENARIO,
  selected,
  SERVER_URL,
  ENABLE_PUBLISHER,
  ADMIN_CODE: __ENV.ADMIN_CODE || "admin",
  CONNECT_TIMEOUT: Number(__ENV.CONNECT_TIMEOUT || 10000),
  RECONNECT_DELAY: Number(__ENV.RECONNECT_DELAY || 2000),
  MAX_RECONNECTS: Number(__ENV.MAX_RECONNECTS || 20),
  PUBLISH_INTERVAL: publishIntervalMs,
  MARKER_WAIT: Number(__ENV.MARKER_WAIT || 2000),
  MARKER_PREFIX: "[k6]",
  LISTENED_EVENTS: [
    "photo:new",
    "photo:pending",
    "photo:removed",
    "photo:reaction",
    "photo:challengeVote",
    "announcement:new",
    "screen:command",
    "poll:new",
    "poll:update",
    "poll:results",
    "poll:closed",
    "timeline:new",
    "timeline:pending",
    "timeline:removed",
    "planning:new",
    "planning:updated",
    "planning:removed",
    "message:new",
  ],
  estimatedPublishes,
  minMarkerReceived,
  buildOptions,
};
