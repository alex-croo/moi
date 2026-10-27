"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { NavigationCache } from "@/lib/navigation-cache";
import { shoppingNeeds } from "@/lib/shopping";
import type { ShoppingWorkspace } from "@/lib/shopping-types";

const Context = createContext<NavigationCache | null>(null);
export function NavigationCacheProvider({ children, ownerId }: { children: ReactNode; ownerId?: string }) {
  const [cache] = useState(() => new NavigationCache());
  const [ready, setReady] = useState(!ownerId);
  useEffect(() => {
    if (ownerId) { try { cache.restore(ownerId, window.localStorage); } catch { /* Device storage blocked. */ } }
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    setReady(true);
    const invalidate = () => cache.invalidate();
    window.addEventListener("focus", invalidate);
    return () => { window.history.scrollRestoration = previous; window.removeEventListener("focus", invalidate); cache.flush(); cache.clear(); };
  }, [cache, ownerId]);
  return <Context.Provider value={cache}>{ready ? children : null}</Context.Provider>;
}
export function useNavigationCache() {
  const context = useContext(Context);
  const [fallback] = useState(() => new NavigationCache());
  return context || fallback;
}
// Only navigation preferences are remembered here; no draft or form input is cached.
export function useRememberedState<T>(key: string, initial: T) {
  const cache = useNavigationCache();
  const [value, setValue] = useState<T>(() => cache.views.has(key) ? cache.views.get(key) as T : initial);
  const latest = useRef(value); latest.current = value;
  const update = (action: SetStateAction<T>) => {
    const next = typeof action === "function" ? (action as (previous: T) => T)(latest.current) : action;
    latest.current = next; cache.remember(key, next); setValue(next);
  };
  return [value, update] as const;
}
export function useShoppingReport(data: ShoppingWorkspace | undefined, start: string, end: string, optional = false, enabled = true) {
  const cache = useNavigationCache();
  return data && enabled ? cache.calculate(data, `shopping:${start}:${end}:${optional}`, () => shoppingNeeds(data, data, start, end, optional)) : null;
}
