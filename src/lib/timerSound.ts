const TICK_SRC = "/sounds/timer-tick.mp3";
const END_SRC = "/sounds/timer-end.mp3";

let tickAudio: HTMLAudioElement | null = null;
let endAudio: HTMLAudioElement | null = null;

function play(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    // autoplay refusé / environnement sans Audio : pas bloquant.
  }
}

/** Bip court joué à chaque seconde des 5 dernières secondes du minuteur. */
export function playTimerTick(volume = 0.5) {
  if (typeof window === "undefined") return;
  if (!tickAudio) tickAudio = new Audio(TICK_SRC);
  tickAudio.volume = Math.max(0, Math.min(1, volume));
  play(tickAudio);
}

/** Buzzer joué une fois quand le minuteur arrive à 0. */
export function playTimerEnd(volume = 0.6) {
  if (typeof window === "undefined") return;
  if (!endAudio) endAudio = new Audio(END_SRC);
  endAudio.volume = Math.max(0, Math.min(1, volume));
  play(endAudio);
}
