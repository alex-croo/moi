"use client";
import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: ReactNode; text: string; disabled?: boolean };
function textOf(node: ReactNode): string {
  return Children.toArray(node).map(n => typeof n === "string" || typeof n === "number" ? String(n) : isValidElement<{ children?: ReactNode }>(n) ? textOf(n.props.children) : "").join("");
}
type Props = { children: ReactNode; value?: string | number; defaultValue?: string | number; name?: string; id?: string;
  disabled?: boolean; required?: boolean; className?: string; "aria-label"?: string;
  onChange?: (event: { target: { value: string } }) => void;
};

/** A shared, keyboard-accessible picker in the top layer, including inside dialogs. */
export function AppSelect(props: Props) {
  const generated = useId(), id = props.id || `select-${generated}`, listId = `${id}-options`;
  const options: Option[] = Children.toArray(props.children).filter(isValidElement).map(n => {
    const option = n as React.ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    return { value: String(option.props.value ?? textOf(option.props.children)), label: option.props.children, text: textOf(option.props.children), disabled: option.props.disabled };
  });
  const [internal, setInternal] = useState(String(props.defaultValue ?? options[0]?.value ?? ""));
  const value = String(props.value ?? internal), selected = options.findIndex(o => o.value === value);
  const [open, setOpen] = useState(false), [active, setActive] = useState(Math.max(0, selected)), [label, setLabel] = useState("");
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), search = useRef({ value: "", at: 0 });
  useLayoutEffect(() => {
    const parent = trigger.current?.closest("label")?.cloneNode(true) as HTMLElement | undefined;
    parent?.querySelectorAll(".app-select").forEach(n => n.remove());
    setLabel(parent?.textContent?.trim() || "");
  }, [props.children]);
  function fit() {
    const button = trigger.current, popover = menu.current;
    if (!button || !popover) return;
    const rect = button.getBoundingClientRect(), viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
    const availableBelow = top + height - rect.bottom - 12, above = rect.top - top - 12;
    const down = availableBelow >= Math.min(280, above), available = Math.max(80, down ? availableBelow : above);
    const h = Math.min(320, available), w = Math.min(Math.max(rect.width, 220), width - 24);
    Object.assign(popover.style, { width: `${w}px`, maxHeight: `${h}px`, left: `${Math.max(left + 12, Math.min(rect.left, left + width - w - 12))}px`,
      top: down ? `${rect.bottom + 6}px` : "auto", bottom: down ? "auto" : `${innerHeight - rect.top + 6}px` });
  }
  function close(focus = false) { menu.current?.hidePopover(); setOpen(false); if (focus) trigger.current?.focus(); }
  function show() {
    if (props.disabled) return;
    setActive(Math.max(0, selected)); fit(); menu.current?.showPopover(); setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    setInternal(option.value); props.onChange?.({ target: { value: option.value } }); close(true);
  }
  useEffect(() => {
    if (!open) return;
    fit();
    const popover = menu.current, option = popover?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (popover && option) {
      const top = option.offsetTop, bottom = top + option.offsetHeight;
      if (top < popover.scrollTop) popover.scrollTop = top;
      else if (bottom > popover.scrollTop + popover.clientHeight) popover.scrollTop = bottom - popover.clientHeight;
    }
  }, [active, open]);
  useEffect(() => {
    if (!open) return;
    const reposition = (e: Event) => { if (!menu.current?.contains(e.target as Node)) fit(); };
    window.addEventListener("resize", fit); window.visualViewport?.addEventListener("resize", fit);
    document.addEventListener("scroll", reposition, true);
    return () => { window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); document.removeEventListener("scroll", reposition, true); };
  }, [open]);
  function key(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab") { close(); return; }
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      const direction = event.key === "ArrowUp" ? -1 : 1;
      let index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : active;
      if (event.key.startsWith("Arrow")) index = (index + direction + options.length) % options.length;
      for (let n = 0; n < options.length && options[index]?.disabled; n++) index = (index + direction + options.length) % options.length;
      setActive(index); return;
    }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (open) choose(active); else show(); return; }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const now = Date.now(); search.current = { value: (now - search.current.at < 800 ? search.current.value : "") + event.key.toLocaleLowerCase(), at: now };
      const found = options.findIndex(o => !o.disabled && o.text.toLocaleLowerCase().startsWith(search.current.value));
      if (!open) show(); if (found >= 0) setActive(found);
    }
  }
  return <span className={`app-select ${props.className || ""}`}>
    {props.name && <input type="hidden" name={props.name} value={value} disabled={props.disabled}/>}
    <button ref={trigger} id={id} type="button" role="combobox" aria-label={props["aria-label"] || label || undefined}
      aria-controls={listId} aria-expanded={open} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      aria-required={props.required} disabled={props.disabled} data-value={value} className="app-select-trigger"
      onClick={() => open ? close() : show()} onKeyDown={key}><span>{options[selected]?.label || options[0]?.label}</span><ChevronDown size={16} aria-hidden="true"/></button>
    <div ref={menu} id={listId} popover="auto" role="listbox" aria-label="Options" className="app-select-menu"
      onToggle={e => setOpen((e.nativeEvent as ToggleEvent).newState === "open")} onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
      {options.map((option, index) => <div id={`${id}-option-${index}`} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
        data-index={index} data-value={option.value} data-active={index === active || undefined} key={option.value}
        onMouseDown={e => e.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(index)}>
        <span>{option.label}</span>{option.value === value && <Check size={16} aria-hidden="true"/>}
      </div>)}
    </div>
  </span>;
}
