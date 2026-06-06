"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { auth, LoginResponse } from "@/lib/api";
import { DEMO_ACCOUNTS, DEMO_SCHOOL_ID } from "@/lib/demo";

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
    // Restore demo session without hitting the backend
    if (localStorage.getItem("knotty_demo") === "true") {
      const saved = localStorage.getItem("knotty_demo_user");
      if (saved) setUser(JSON.parse(saved) as User);
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("knotty_token");
    const refreshToken = localStorage.getItem("knotty_refresh");
    if (!token && !refreshToken) { setLoading(false); return; }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );

    Promise.race([auth.me(), timeout])
      .then((res) => setUser((res as Awaited<ReturnType<typeof auth.me>>).user))
      .catch(() => {
        localStorage.removeItem("knotty_token");
        localStorage.removeItem("knotty_refresh");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Demo mode — no backend needed
    const demo = DEMO_ACCOUNTS.find((a) => a.email === email && a.password === password);
    if (demo) {
      const demoUser: User = {
        id: `demo-${demo.role.toLowerCase()}`,
        role: demo.role,
        school_id: DEMO_SCHOOL_ID,
        first_name: demo.first_name,
        last_name: demo.last_name,
        email: demo.email,
        profile_photo: null,
      };
      localStorage.setItem("knotty_demo", "true");
      localStorage.setItem("knotty_demo_user", JSON.stringify(demoUser));
      setUser(demoUser);
      return;
    }

    const res = await auth.login(email, password);
    localStorage.setItem("knotty_token", res.accessToken);
    localStorage.setItem("knotty_refresh", res.refreshToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    auth.logout().catch(() => {});
    localStorage.removeItem("knotty_token");
    localStorage.removeItem("knotty_refresh");
    localStorage.removeItem("knotty_demo");
    localStorage.removeItem("knotty_demo_user");
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
