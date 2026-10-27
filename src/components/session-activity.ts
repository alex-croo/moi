"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/locale";

// Only opening/returning to the app and genuine interactions extend a login.
// Autosave, AI polling, image loads and token refreshes cannot keep it alive.
export function useSessionActivity(locale: Locale) {
  useEffect(() => {
    let alive = true, pending = false, lastSent = 0, expiresAt = 0;
    async function request(touch: boolean) {
      if (pending || !alive) return;
      pending = true;
      try {
        const response = await fetch("/api/session", { method: touch ? "POST" : "GET", cache: "no-store" });
        if (!alive) return;
        if (response.status === 401) {
          window.location.replace(`/${locale}?error=session`);
          return;
        }
        if (response.ok) {
          expiresAt = Date.parse((await response.json()).expiresAt);
          if (touch) lastSent = Date.now();
        }
      } catch { /* Retry on the next interaction or when connectivity returns. */ }
      finally { pending = false; }
    }
    const activity = (event: Event) => {
      if (event.isTrusted && document.visibilityState === "visible" && Date.now() - lastSent >= 60_000) void request(true);
    };
    const visible = () => {
      if (document.visibilityState === "visible") void request(true);
    };
    const check = () => {
      if (expiresAt && Date.now() >= expiresAt) void request(false);
    };
    const online = () => { void request(false); };
    for (const event of ["pointerdown", "keydown", "wheel", "touchmove"]) window.addEventListener(event, activity, { passive: true });
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    window.addEventListener("online", online);
    const timer = setInterval(check, 60_000);
    visible();
    return () => {
      alive = false; clearInterval(timer);
      for (const event of ["pointerdown", "keydown", "wheel", "touchmove"]) window.removeEventListener(event, activity);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", online);
    };
  }, [locale]);
}
