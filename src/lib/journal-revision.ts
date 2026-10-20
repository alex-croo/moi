export type TextChange = { kind: "same" | "remove" | "add"; text: string };
const tokens = (text: string) =>
  text.match(/\s+|[\p{L}\p{N}\p{M}]+|[^\s]/gu) || [];

// Word-level edits preserve every character, including blank lines. Bound the
// matrix for long selections; a coarse replacement is still exact and reviewable.
export function journalChanges(before: string, after: string): TextChange[] {
  const a = tokens(before),
    b = tokens(after),
    changes: TextChange[] = [];
  const push = (kind: TextChange["kind"], text: string) => {
    if (!text) return;
    const last = changes.at(-1);
    if (last?.kind === kind) last.text += text;
    else changes.push({ kind, text });
  };
  let prefix = 0,
    suffix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix])
    prefix++;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - suffix - 1] === b[b.length - suffix - 1]
  )
    suffix++;
  push("same", a.slice(0, prefix).join(""));
  const x = a.slice(prefix, a.length - suffix),
    y = b.slice(prefix, b.length - suffix);
  if ((x.length + 1) * (y.length + 1) > 750000) {
    push("remove", x.join(""));
    push("add", y.join(""));
  } else {
    const width = y.length + 1,
      matrix = new Uint16Array((x.length + 1) * width);
    for (let i = x.length - 1; i >= 0; i--)
      for (let j = y.length - 1; j >= 0; j--)
        matrix[i * width + j] =
          x[i] === y[j]
            ? matrix[(i + 1) * width + j + 1] + 1
            : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
    let i = 0,
      j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) {
        push("same", x[i++]);
        j++;
      } else if (
        i < x.length &&
        (j === y.length ||
          matrix[(i + 1) * width + j] >= matrix[i * width + j + 1])
      )
        push("remove", x[i++]);
      else push("add", y[j++]);
    }
  }
  push("same", suffix ? a.slice(-suffix).join("") : "");
  return changes;
}

export function applyJournalSuggestion(
  current: string,
  proposal: { original: string; start: number; end: number; text: string },
) {
  if (current !== proposal.original) throw Error("stale");
  if (
    proposal.start < 0 ||
    proposal.end <= proposal.start ||
    proposal.end > current.length
  )
    throw Error("range");
  const next =
    current.slice(0, proposal.start) +
    proposal.text +
    current.slice(proposal.end);
  if (next.length > 20000) throw Error("too_long");
  return next;
}
