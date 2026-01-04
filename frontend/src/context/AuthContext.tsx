import { createContext } from "react";

export interface User {
  id: number;
  full_name: string;
  email: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;

  login: (
    email: string,
    password: string,
    rememberMe: boolean
  ) => Promise<void>;

  register: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<{ message: string }>;

  logout: () => Promise<void>;
  extendSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);
