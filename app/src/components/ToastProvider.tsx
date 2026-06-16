"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import {
  emitToast,
  registerToastHandler,
  type ToastType,
} from "@/lib/toastBus";

/** Durée avant disparition automatique (ms). */
const TOAST_DISMISS_MS = 4000;
const TOAST_FADE_MS = 320;

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  leaving: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastSeq = 0;

function toastStyles(type: ToastType): string {
  switch (type) {
    case "success":
      return "ring-green-400/40 text-green-100";
    case "error":
      return "ring-orange-400/50 text-orange-100";
    default:
      return "ring-[color-mix(in_srgb,var(--event-accent)_55%,white)] text-purple-50";
  }
}

function toastAccent(type: ToastType): React.CSSProperties {
  switch (type) {
    case "success":
      return {
        background:
          "color-mix(in srgb, var(--event-primary) 82%, rgb(34 197 94 / 0.22))",
      };
    case "error":
      return {
        background:
          "color-mix(in srgb, var(--event-primary) 82%, rgb(249 115 22 / 0.22))",
      };
    default:
      return {
        background:
          "color-mix(in srgb, var(--event-secondary) 88%, transparent)",
      };
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    }, TOAST_FADE_MS);
    timersRef.current.set(`${id}:remove`, removeTimer);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `toast-${++toastSeq}`;
      setToasts((prev) => [...prev, { id, message, type, leaving: false }]);

      const autoTimer = setTimeout(() => dismissToast(id), TOAST_DISMISS_MS);
      timersRef.current.set(id, autoTimer);
    },
    [dismissToast]
  );

  useEffect(() => {
    registerToastHandler(showToast);
    return () => {
      registerToastHandler(null);
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 px-4 pb-20 sm:pb-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`toast-enter pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ring-1 backdrop-blur-md ${
              toast.leaving ? "toast-leave" : ""
            } ${toastStyles(toast.type)}`}
            style={toastAccent(toast.type)}
          >
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 cursor-pointer rounded-full px-1.5 py-0.5 text-white/70 transition-transform hover:text-white active:scale-95"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast doit être utilisé dans ToastProvider");
  }
  return ctx;
}

/** Alias pour usage hors hook (délègue au bus une fois le provider monté). */
export { emitToast as showToastGlobal };
