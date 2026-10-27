"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useNavigationCache } from "./navigation-cache";

/** Remember before unmount: a shorter destination can clamp window.scrollY. */
export function useSectionScroll(section: string) {
  const cache = useNavigationCache();
  const content = useRef<HTMLElement>(null);
  const restoring = useRef(false);

  function remember(nextSection: string) {
    if (nextSection !== section) {
      cache.remember(`scroll:${section}`, Math.max(0, window.scrollY));
    }
  }

  useLayoutEffect(() => {
    restoring.current = true;
    const top = Number(cache.views.get(`scroll:${section}`)) || 0;
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function stop() {
      restoring.current = false;
      stopped = true;
      observer?.disconnect();
      clearTimeout(timer);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
    }

    function restore() {
      if (stopped) return;
      window.scrollTo({ top, behavior: "instant" });
      if (Math.abs(window.scrollY - top) < 1) stop();
    }

    restore();
    // Async sections may not be tall enough on their first render. Retry only
    // while their content grows; never pull the user back after they interact.
    if (!stopped && content.current) {
      observer = new ResizeObserver(restore);
      observer.observe(content.current);
      window.addEventListener("wheel", stop, { passive: true });
      window.addEventListener("touchstart", stop, { passive: true });
      window.addEventListener("pointerdown", stop, { passive: true });
      window.addEventListener("keydown", stop);
      timer = setTimeout(stop, 3000);
    }
    return stop;
  }, [cache, section]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer); timer = undefined;
      if (!restoring.current) cache.remember(`scroll:${section}`, Math.max(0, window.scrollY));
    };
    const scroll = () => { if (!timer) timer = setTimeout(save, 200); };
    const hide = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [cache, section]);

  return { content, remember };
}
