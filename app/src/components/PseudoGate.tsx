"use client";

import { useEffect, useState } from "react";
import {
  getGuestPseudo,
  setGuestPseudo,
  validatePseudo,
} from "@/lib/guestPseudo";

interface PseudoGateProps {
  children: React.ReactNode;
}

/** Modale pseudo au premier visit (localStorage guest:pseudo). */
export function PseudoGate({ children }: PseudoGateProps) {
  const [ready, setReady] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReady(!!getGuestPseudo());
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = validatePseudo(pseudo);
    if (!valid) {
      setError("Entre un pseudo entre 2 et 20 caractères");
      return;
    }
    setGuestPseudo(valid);
    setReady(true);
    setError(null);
  }

  if (ready) return <>{children}</>;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-4 rounded-2xl bg-purple-950/95 p-6 shadow-2xl ring-1 ring-white/20"
        >
          <h2 className="text-center text-xl font-bold text-white">
            Comment t&apos;appelles-tu ?
          </h2>
          <p className="text-center text-sm text-purple-200">
            Ton pseudo apparaît au classement des défis photo 🎯
          </p>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value.slice(0, 20))}
            placeholder="Ex: Thomas"
            autoFocus
            maxLength={20}
            className="w-full rounded-xl bg-white/10 px-4 py-3 text-white ring-1 ring-white/20 placeholder:text-purple-400 focus:ring-pink-400 focus:outline-none"
          />
          {error && (
            <p className="text-center text-sm text-orange-300">{error}</p>
          )}
          <button
            type="submit"
            className="w-full cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 py-3 font-bold text-white transition-transform active:scale-95"
          >
            C&apos;est parti !
          </button>
        </form>
      </div>
      <div className="pointer-events-none opacity-30">{children}</div>
    </>
  );
}
