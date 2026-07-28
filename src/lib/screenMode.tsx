"use client";

import { createContext, useContext } from "react";

/**
 * Context indiquant que le rendu se passe dans /screen (TV).
 * Permet aux composants de masquer les UI interactives (nav, boutons upload…).
 */
export const ScreenModeContext = createContext(false);

export function useScreenMode(): boolean {
  return useContext(ScreenModeContext);
}
