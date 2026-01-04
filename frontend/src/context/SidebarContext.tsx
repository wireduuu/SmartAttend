import { createContext } from "react";

export type SidebarContextType = {
  collapsed: boolean;
  toggle: () => void;
};

export const SidebarContext = createContext<SidebarContextType | null>(null);
