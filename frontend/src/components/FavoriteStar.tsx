import type { MouseEvent } from "react";

interface Props {
  active: boolean;
  onToggle: () => void;
  className?: string;
  ariaLabel?: string;
  /**
   * "overlay" → small pill rendered over a colored tile (Heatmap).
   *   The backdrop ensures the icon stays legible regardless of tile color.
   * "inline" → no backdrop, used on dark/neutral rows (TrendingPanel).
   */
  variant?: "overlay" | "inline";
}

export function FavoriteStar({
  active,
  onToggle,
  className = "",
  ariaLabel,
  variant = "inline",
}: Props) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle();
  };

  const isOverlay = variant === "overlay";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel ?? (active ? "Quitar de favoritos" : "Agregar a favoritos")}
      aria-pressed={active}
      title={active ? "Quitar de favoritos" : "Agregar a favoritos"}
      className={`cursor-pointer leading-none transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-[#4fc3f7] focus-visible:outline-offset-1 ${
        isOverlay
          ? "border-0 px-1 py-0 text-[0.85rem] rounded-full backdrop-blur-sm"
          : "bg-transparent border-0 p-0 text-base"
      } ${className}`}
      style={{
        color: active ? "var(--color-warning)" : isOverlay ? "rgba(255,255,255,0.85)" : "var(--color-text-faint)",
        textShadow: isOverlay ? "0 1px 2px rgba(0,0,0,0.7)" : undefined,
        background: isOverlay ? "rgba(0,0,0,0.35)" : "transparent",
      }}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
