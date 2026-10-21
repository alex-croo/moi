"use client";
import { useEffect, useRef } from "react";

/** Keep the native dialog inside the visible area, including above a mobile keyboard. */
export function useShoppingDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const revealField = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const field = document.activeElement;
        if (!(field instanceof HTMLElement) || !dialog.contains(field) || !field.matches("input,select,textarea")) return;
        const bounds = dialog.getBoundingClientRect(), input = field.getBoundingClientRect();
        const top = bounds.top + (dialog.querySelector("header")?.getBoundingClientRect().height ?? 0) + 12;
        const bottom = bounds.bottom - 12;
        // Scroll only the dialog, never the page beneath it or the user's zoom level.
        if (input.bottom > bottom) dialog.scrollTop += input.bottom - bottom;
        else if (input.top < top) dialog.scrollTop -= top - input.top;
      });
    };
    const fit = () => {
      dialog.style.setProperty("--dialog-width", `${viewport?.width ?? window.innerWidth}px`);
      dialog.style.setProperty("--dialog-height", `${viewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty("--dialog-left", `${viewport?.offsetLeft ?? 0}px`);
      dialog.style.setProperty("--dialog-top", `${viewport?.offsetTop ?? 0}px`);
      revealField();
    };
    fit();
    if (!dialog.open) dialog.showModal();
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    dialog.addEventListener("focusin", revealField);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      dialog.removeEventListener("focusin", revealField);
    };
  }, []);
  return ref;
}
