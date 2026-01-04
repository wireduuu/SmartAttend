import { useState, type ReactNode } from "react";
import { SidebarContext } from "../context/SidebarContext";

type Props = {
  children: ReactNode;
};

export function SidebarProvider({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = () => setCollapsed((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}
