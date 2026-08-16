const ANNOUNCEMENT_SOUND_SRC = "/sounds/announcement.mp3";

let cached: HTMLAudioElement | null = null;

/**
 * Joue le carillon d'annonce (déclenché à l'apparition en plein écran).
 * Best-effort : si l'autoplay est bloqué (pas encore d'interaction utilisateur
 * sur la page), on ignore silencieusement l'erreur — l'annonce reste visible.
 */
export function playAnnouncementSound(volume = 0.55) {
  if (typeof window === "undefined") return;
  try {
    if (!cached) {
      cached = new Audio(ANNOUNCEMENT_SOUND_SRC);
    }
    cached.currentTime = 0;
    cached.volume = Math.max(0, Math.min(1, volume));
    void cached.play().catch(() => {});
  } catch {
    // Environnement sans Audio ou autoplay refusé : pas bloquant.
  }
}
