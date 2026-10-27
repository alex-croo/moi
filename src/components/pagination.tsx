"use client";
import "./pagination.css";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageWindow } from "@/lib/navigation-cache";
import { useRememberedState } from "./navigation-cache";
import { useText } from "./locale-provider";

export function usePagination<T>(items: readonly T[], key: string, filter = "", ready = true) {
  const [saved, setSaved] = useRememberedState(`page:${key}`, { filter, page: 1 });
  const anchor = useRef<HTMLElement | null>(null);
  const window = pageWindow(items.length, saved.filter === filter ? saved.page : 1);
  useEffect(() => { if (ready && (saved.filter !== filter || saved.page !== window.page)) setSaved({filter, page: window.page}); }, [filter, saved.filter, saved.page, window.page, ready]);
  return { ...window, anchor, items: items.slice(window.start, window.end),
    setPage: (page: number) => setSaved({ filter, page }) };
}
export function Pagination({ pagination, label }: { pagination: ReturnType<typeof usePagination>; label?: string }) {
  const t = useText(), ref = useRef<HTMLElement>(null);
  if (pagination.total <= 50) return null;
  function change(page: number) {
    pagination.setPage(page);
    pagination.anchor.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return <nav ref={element => { if (!element && pagination.anchor.current===ref.current) pagination.anchor.current=null; ref.current=element; if (element && !pagination.anchor.current) pagination.anchor.current=element; }} className="list-pagination" aria-label={label || t("Pagination", "Pagination")}>
    <span aria-live="polite">{pagination.start + 1}–{pagination.end} / {pagination.total}</span>
    <div><button type="button" className="secondary" disabled={pagination.page === 1} onClick={() => change(pagination.page - 1)} aria-label={t("Page précédente", "Previous page")}><ChevronLeft size={16}/></button>
    <span>{pagination.page} / {pagination.pages}</span>
    <button type="button" className="secondary" disabled={pagination.page === pagination.pages} onClick={() => change(pagination.page + 1)} aria-label={t("Page suivante", "Next page")}><ChevronRight size={16}/></button></div>
  </nav>;
}
