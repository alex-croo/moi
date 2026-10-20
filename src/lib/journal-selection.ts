type Rect = { left: number; top: number; width: number; height: number };
// Textareas keep native typing, IME, undo and paragraph breaks. This temporary
// mirror measures the actual selected lines without adding journal text to state.
export function journalSelectionPosition(editor: HTMLTextAreaElement, start: number, end: number): Rect[] {
  const mirror = document.createElement("div"), style = getComputedStyle(editor), bounds = editor.getBoundingClientRect();
  for (const property of ["font-family", "font-size", "font-weight", "font-style", "letter-spacing", "line-height", "text-indent", "tab-size", "padding", "border", "box-sizing", "word-spacing", "text-transform"])
    mirror.style.setProperty(property, style.getPropertyValue(property));
  Object.assign(mirror.style, {
    position: "fixed", left: "0", top: "0", visibility: "hidden", pointerEvents: "none",
    width: `${bounds.width}px`, whiteSpace: "pre-wrap", overflowWrap: "break-word",
  });
  mirror.setAttribute("aria-hidden", "true");
  const node = document.createTextNode(editor.value + "\u200b");
  mirror.append(node);
  document.body.append(mirror);
  try {
    const range = document.createRange();
    range.setStart(node, Math.min(start, editor.value.length));
    range.setEnd(node, Math.min(Math.max(start + 1, end), node.length));
    return [...range.getClientRects()].map(rect => ({
      left: bounds.left + rect.left - editor.scrollLeft,
      top: bounds.top + rect.top - editor.scrollTop,
      width: rect.width, height: rect.height || 30,
    }));
  } finally { mirror.remove(); }
}

export function placeJournalToolbar(rects: Rect[], size: { width: number; height: number }, viewport: Rect) {
  const margin = 12, gap = 9;
  const first = rects.find(rect => rect.top + rect.height > viewport.top + margin && rect.top < viewport.top + viewport.height - margin);
  if (!first) return { left: 0, top: 0, visible: false };
  const last = [...rects].reverse().find(rect => rect.top < viewport.top + viewport.height - margin) || first;
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, Math.max(low, high)));
  const above = first.top - size.height - gap;
  const below = last.top + last.height + gap;
  return {
    left: clamp(first.left + first.width / 2 - size.width / 2, viewport.left + margin, viewport.left + viewport.width - size.width - margin),
    top: clamp(above >= viewport.top + margin ? above : below + size.height <= viewport.top + viewport.height - margin ? below : above, viewport.top + margin, viewport.top + viewport.height - size.height - margin),
    visible: true,
  };
}
