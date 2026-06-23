import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  /** When true the confirm button is styled as a destructive (red) action. Defaults to true. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Borrar",
  cancelLabel = "Cancelar",
  loading = false,
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button when the dialog opens.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    // Overlay — click outside = cancel
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      aria-hidden="false"
    >
      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm mx-4 bg-bg-surface border border-border-soft rounded-lg shadow-2xl p-6 flex flex-col gap-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-text-primary leading-snug">
          {title}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-md bg-bg-raised border border-border-soft text-text-secondary hover:text-text-primary hover:border-border transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm rounded-md font-medium transition-colors cursor-pointer disabled:opacity-50 ${
              destructive
                ? "bg-red-700 hover:bg-red-600 text-white border border-red-600"
                : "bg-accent hover:opacity-90 text-white border border-accent"
            }`}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
