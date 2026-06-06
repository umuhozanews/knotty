"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { auth, LoginResponse } from "@/lib/api";

type User = LoginResponse["user"];

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("knotty_token");
    const refreshToken = localStorage.getItem("knotty_refresh");
    if (!token && !refreshToken) { setLoading(false); return; }

    auth.me()
      .then((res) => setUser(res.user))
      .catch(() => {
        // Token expired — api.ts already attempted refresh automatically inside auth.me().
        // If it succeeded, user was set; if it failed (redirect happened), clear storage.
        localStorage.removeItem("knotty_token");
        localStorage.removeItem("knotty_refresh");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await auth.login(email, password);
    localStorage.setItem("knotty_token", res.accessToken);
    localStorage.setItem("knotty_refresh", res.refreshToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    auth.logout().catch(() => {});
    localStorage.removeItem("knotty_token");
    localStorage.removeItem("knotty_refresh");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
