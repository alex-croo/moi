// Textareas preserve native typing, IME, undo and exact paragraph breaks. A
// temporary, invisible text mirror locates the selected passage for the toolbar.
export function journalSelectionPosition(
  editor: HTMLTextAreaElement,
  index: number,
) {
  const mirror = document.createElement("div"),
    style = getComputedStyle(editor);
  for (const property of [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "letter-spacing",
    "line-height",
    "text-indent",
    "tab-size",
    "padding",
    "border",
    "box-sizing",
  ])
    mirror.style.setProperty(property, style.getPropertyValue(property));
  Object.assign(mirror.style, {
    position: "fixed",
    left: "0",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
    width: `${editor.getBoundingClientRect().width}px`,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  });
  const node = document.createTextNode(editor.value + "\u200b");
  mirror.append(node);
  document.body.append(mirror);
  try {
    const range = document.createRange();
    range.setStart(node, Math.min(index, editor.value.length));
    range.setEnd(node, Math.min(index + 1, node.length));
    const rect = range.getBoundingClientRect();
    return { left: rect.left, top: rect.top, height: rect.height || 30 };
  } finally {
    mirror.remove();
  }
}
