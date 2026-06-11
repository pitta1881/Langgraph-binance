import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function PanelTitle({ children }: Props) {
  return (
    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-1">
      {children}
    </h3>
  );
}
