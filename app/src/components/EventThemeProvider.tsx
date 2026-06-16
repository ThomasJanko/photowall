"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  eventConfig as defaultEventConfig,
  type EventConfig,
} from "@/config/event";
import { applyThemeToDocument } from "@/lib/applyEventTheme";
import { fetchEventConfig } from "@/lib/eventConfigApi";
import { getTimeTheme } from "@/lib/timeTheme";
import { deferCallback } from "@/lib/deferCallback";

const THEME_REFRESH_MS = 5 * 60_000;

interface EventConfigContextValue {
  config: EventConfig;
  loaded: boolean;
  refreshConfig: () => Promise<void>;
  accent: string;
}

const EventConfigContext = createContext<EventConfigContextValue>({
  config: defaultEventConfig,
  loaded: false,
  refreshConfig: async () => {},
  accent: defaultEventConfig.theme.accent,
});

/** Config événement courante (API ou défauts). */
export function useEventConfig(): EventConfigContextValue {
  return useContext(EventConfigContext);
}

/** Alias rétrocompatible pour l'accent confettis. */
export function useEventTheme(): { accent: string } {
  const { accent } = useEventConfig();
  return { accent };
}

/**
 * Charge GET /api/config au montage (fallback offline sur event.ts),
 * applique les CSS variables du thème.
 */
export function EventThemeProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [config, setConfig] = useState<EventConfig>(defaultEventConfig);
  const [loaded, setLoaded] = useState(false);
  const [accent, setAccent] = useState(defaultEventConfig.theme.accent);

  const applyTheme = useCallback((cfg: EventConfig) => {
    const colors = cfg.features.timeBasedTheme ? getTimeTheme() : cfg.theme;
    applyThemeToDocument(colors);
    setAccent(colors.accent);
  }, []);

  const refreshConfig = useCallback(async () => {
    const next = await fetchEventConfig();
    setConfig(next);
    applyTheme(next);
  }, [applyTheme]);

  useEffect(() => {
    fetchEventConfig()
      .then((cfg) => {
        setConfig(cfg);
        applyTheme(cfg);
      })
      .finally(() => setLoaded(true));
  }, [applyTheme]);

  useEffect(() => {
    if (!loaded) return;
    deferCallback(() => {
      if (!config.features.timeBasedTheme) {
        applyTheme(config);
        return;
      }
      applyTheme(config);
    });
    if (!config.features.timeBasedTheme) return;
    const interval = setInterval(() => applyTheme(config), THEME_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loaded, config, applyTheme]);

  return (
    <EventConfigContext.Provider
      value={{ config, loaded, refreshConfig, accent }}
    >
      {children}
    </EventConfigContext.Provider>
  );
}
