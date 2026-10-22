"use client";
import { useEffect, useRef, useState } from "react";
import { ShoppingSelectionQueue } from "@/lib/shopping-selection";
import type { ShoppingMutation } from "@/lib/shopping";
export function useShoppingSelection(range: { start: string; end: string }, saved: string[], onSave: (m: ShoppingMutation) => Promise<void>) {
  const ref = useRef<ShoppingSelectionQueue | null>(null);
  if (!ref.current) ref.current = new ShoppingSelectionQueue(onSave);
  const queue = ref.current;
  queue.save = onSave;
  const [, render] = useState(0);
  useEffect(() => { queue.notify = () => render(n => n + 1); return () => { queue.notify = () => {}; }; }, [queue]);
  return { selected: queue.selected(range, saved), select: (ids: string[], checked: boolean) => queue.select(range, ids, checked),
    saving: queue.snapshot.saving, error: queue.snapshot.error, retry: () => void queue.flush() };
}
