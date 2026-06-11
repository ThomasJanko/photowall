"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { eventConfig } from "@/config/event";
import { applyThemeToDocument } from "@/lib/applyEventTheme";
import { getTimeTheme } from "@/lib/timeTheme";

const THEME_REFRESH_MS = 5 * 60_000;

interface EventThemeContextValue {
  accent: string;
}

const EventThemeContext = createContext<EventThemeContextValue>({
  accent: eventConfig.theme.accent,
});

/** Expose l'accent courant (ex: confettis sur /wall). */
export function useEventTheme(): EventThemeContextValue {
  return useContext(EventThemeContext);
}

/**
 * Initialise les CSS variables depuis eventConfig et, si activé,
 * les met à jour selon l'heure (timeBasedTheme).
 */
export function EventThemeProvider({ children }: { readonly children: ReactNode }) {
  const [accent, setAccent] = useState(eventConfig.theme.accent);

  useEffect(() => {
    const apply = () => {
      const colors = eventConfig.features.timeBasedTheme
        ? getTimeTheme()
        : eventConfig.theme;
      applyThemeToDocument(colors);
      setAccent(colors.accent);
    };

    apply();
    if (!eventConfig.features.timeBasedTheme) return;
    const interval = setInterval(apply, THEME_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <EventThemeContext.Provider value={{ accent }}>
      {children}
    </EventThemeContext.Provider>
  );
}
