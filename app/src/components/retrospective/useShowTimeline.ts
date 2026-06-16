"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/retrospectiveScenes";
import { deferCallback } from "@/lib/deferCallback";

const TRANSITION_MS = 600;

interface UseShowTimelineOptions {
  scenes: Scene[];
  active: boolean;
}

export function useShowTimeline({ scenes, active }: UseShowTimelineOptions) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (transitionRef.current) clearTimeout(transitionRef.current);
    timerRef.current = null;
    transitionRef.current = null;
  }, []);

  const goToScene = useCallback(
    (next: number) => {
      clearTimers();
      if (next >= scenes.length) {
        setFinished(true);
        setVisible(false);
        return;
      }

      setVisible(false);
      transitionRef.current = setTimeout(() => {
        setSceneIndex(next);
        setVisible(true);
      }, TRANSITION_MS);
    },
    [scenes.length, clearTimers]
  );

  useEffect(() => {
    clearTimers();
    if (!active || paused || finished || scenes.length === 0) return;

    const scene = scenes[sceneIndex];
    if (!scene) return;

    timerRef.current = setTimeout(() => {
      goToScene(sceneIndex + 1);
    }, scene.durationMs);

    return clearTimers;
  }, [active, paused, finished, scenes, sceneIndex, goToScene, clearTimers]);

  useEffect(() => {
    if (!active) {
      clearTimers();
      deferCallback(() => {
        setSceneIndex(0);
        setPaused(false);
        setFinished(false);
        setVisible(true);
      });
    }
  }, [active, clearTimers]);

  function togglePause() {
    setPaused((p) => !p);
  }

  function skipScene() {
    goToScene(sceneIndex + 1);
  }

  return {
    sceneIndex,
    currentScene: scenes[sceneIndex] ?? null,
    paused,
    visible,
    finished,
    togglePause,
    skipScene,
    transitionMs: TRANSITION_MS,
  };
}
