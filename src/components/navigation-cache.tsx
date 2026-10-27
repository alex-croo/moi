"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { NavigationCache } from "@/lib/navigation-cache";
import { shoppingNeeds } from "@/lib/shopping";
import type { ShoppingWorkspace } from "@/lib/shopping-types";

const Context = createContext<NavigationCache | null>(null);
export function NavigationCacheProvider({ children }: { children: ReactNode }) {
  const [cache] = useState(() => new NavigationCache());
  useEffect(() => {
    const invalidate = () => cache.invalidate();
    const clear = () => cache.clear();
    window.addEventListener("focus", invalidate);
    window.addEventListener("pagehide", clear);
    return () => { window.removeEventListener("focus", invalidate); window.removeEventListener("pagehide", clear); cache.clear(); };
  }, [cache]);
  return <Context.Provider value={cache}>{children}</Context.Provider>;
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
    latest.current = next; cache.views.set(key, next); setValue(next);
  };
  return [value, update] as const;
}
export function useShoppingReport(data: ShoppingWorkspace | undefined, start: string, end: string, optional = false, enabled = true) {
  const cache = useNavigationCache();
  return data && enabled ? cache.calculate(data, `shopping:${start}:${end}:${optional}`, () => shoppingNeeds(data, data, start, end, optional)) : null;
}
