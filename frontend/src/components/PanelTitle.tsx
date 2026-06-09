import type { ReactNode } from "react";
import "../styles/panel.css";

interface Props {
  children: ReactNode;
}

export function PanelTitle({ children }: Props) {
  return <h3 className="panel__title">{children}</h3>;
}
