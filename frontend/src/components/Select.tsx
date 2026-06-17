import { useEffect, useRef, useState } from "react";

interface SelectProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  className?: string;
  ariaLabel?: string;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  className = "",
  ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(() => Math.max(0, options.indexOf(value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLLIElement>(`[data-idx="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const commit = (idx: number) => {
    const next = options[idx];
    if (next !== undefined) onChange(next);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) setOpen(true);
      else commit(highlight);
    }
  };

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          setHighlight(Math.max(0, options.indexOf(value)));
          setOpen((o) => !o);
        }}
        onKeyDown={onKeyDown}
        className="flex items-center gap-2 bg-bg-raised border border-border-soft text-text-primary text-xs rounded-md pl-2.5 pr-2 py-1 outline-none focus:border-accent hover:border-accent-hover cursor-pointer transition-colors min-w-[140px] justify-between"
      >
        <span className="truncate">{value}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden
          className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 bottom-full mb-1 left-0 min-w-full bg-bg-raised border border-border-soft rounded-md shadow-lg overflow-hidden py-1"
        >
          {options.map((opt, idx) => {
            const selected = opt === value;
            const active = idx === highlight;
            return (
              <li
                key={opt}
                data-idx={idx}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(idx)}
                className={`px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                  active ? "bg-bg-elev-bubble text-text-primary" : "text-text-secondary"
                } ${selected ? "font-medium" : ""}`}
              >
                {opt}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
