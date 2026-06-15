"use client";

import { useCallback, useEffect, useState } from "react";
import { loadQueue } from "./uploadQueue";

const QUEUE_POLL_MS = 4000;

/** Compteur de photos en attente d'envoi (localStorage uploadQueue). */
export function useUploadQueueStatus() {
  const [queueCount, setQueueCount] = useState(0);

  const refreshQueueCount = useCallback(() => {
    setQueueCount(loadQueue().length);
  }, []);

  useEffect(() => {
    refreshQueueCount();
    const interval = setInterval(refreshQueueCount, QUEUE_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshQueueCount]);

  return { queueCount, refreshQueueCount };
}
