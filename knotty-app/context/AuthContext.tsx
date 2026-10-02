"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { auth, multiSchool, LoginResponse, SchoolItem } from "@/lib/api";
import { DEMO_ACCOUNTS, DEMO_SCHOOL_ID } from "@/lib/demo";

type User = LoginResponse["user"];

interface AuthContextValue {
  user: User | null;
  activeSchool: SchoolItem | null;
  schoolsList: SchoolItem[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchSchool: (schoolId: string) => Promise<void>;
  refreshSchools: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeSchool, setActiveSchool] = useState<SchoolItem | null>(null);
  const [schoolsList, setSchoolsList] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchools = useCallback(async (currentSchoolId?: string) => {
    try {
      const res = await multiSchool.list();
      if (res.data && res.data.length > 0) {
        setSchoolsList(res.data);
        const targetId = currentSchoolId || user?.school_id;
        const matched = res.data.find((s) => s.id === targetId) || res.data[0];
        setActiveSchool(matched);
      }
    } catch (_) {
      // Fallback default school if API offline
      const fallbackSchool: SchoolItem = {
        id: currentSchoolId || DEMO_SCHOOL_ID,
        name: "IshuriHUB Model School",
        code: "KMS",
        email: "admin@ishurihub.rw",
        phone: "+250788000001",
        address: "KG 12 Ave, Kigali, Rwanda",
        subscription_plan: "PREMIUM",
        student_count: 53,
        worker_count: 14,
        class_count: 12,
        canteen_products_count: 6,
      };
      setSchoolsList([fallbackSchool]);
      setActiveSchool(fallbackSchool);
    }
  }, [user?.school_id]);

  useEffect(() => {
    // Restore demo session without hitting the backend
    if (localStorage.getItem("ishuri_demo") === "true" || localStorage.getItem("knotty_demo") === "true") {
      const saved = localStorage.getItem("ishuri_demo_user") || localStorage.getItem("knotty_demo_user");
      if (saved) {
        const u = JSON.parse(saved) as User;
        setUser(u);
        fetchSchools(u.school_id);
      }
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("ishuri_token") || localStorage.getItem("knotty_token");
    const refreshToken = localStorage.getItem("ishuri_refresh") || localStorage.getItem("knotty_refresh");
    if (!token && !refreshToken) { setLoading(false); return; }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );

    Promise.race([auth.me(), timeout])
      .then((res) => {
        const u = (res as Awaited<ReturnType<typeof auth.me>>).user;
        setUser(u);
        fetchSchools(u.school_id);
      })
      .catch(() => {
        localStorage.removeItem("ishuri_token");
        localStorage.removeItem("ishuri_refresh");
        localStorage.removeItem("knotty_token");
        localStorage.removeItem("knotty_refresh");
      })
      .finally(() => setLoading(false));
  }, [fetchSchools]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await auth.login(email, password);
      localStorage.removeItem("ishuri_demo");
      localStorage.removeItem("ishuri_demo_user");
      localStorage.removeItem("knotty_demo");
      localStorage.removeItem("knotty_demo_user");
      localStorage.setItem("ishuri_token", res.accessToken);
      localStorage.setItem("ishuri_refresh", res.refreshToken);
      setUser(res.user);
      fetchSchools(res.user.school_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isConnectionError = msg.includes("non-JSON") || msg.includes("fetch") || msg.includes("Failed to fetch");
      const demo = DEMO_ACCOUNTS.find((a) => a.email === email && a.password === password);

      if (isConnectionError && demo) {
        console.log("Backend offline. Falling back to frontend demo mode.");
        const demoUser: User = {
          id: `demo-${demo.role.toLowerCase()}`,
          role: demo.role,
          school_id: DEMO_SCHOOL_ID,
          first_name: demo.first_name,
          last_name: demo.last_name,
          email: demo.email,
          profile_photo: null,
        };
        localStorage.setItem("ishuri_demo", "true");
        localStorage.setItem("ishuri_demo_user", JSON.stringify(demoUser));
        setUser(demoUser);
        fetchSchools(DEMO_SCHOOL_ID);
      } else {
        throw err;
      }
    }
  }, [fetchSchools]);

  const switchSchool = useCallback(async (schoolId: string) => {
    try {
      const res = await multiSchool.switch(schoolId);
      localStorage.setItem("ishuri_token", res.accessToken);
      localStorage.setItem("ishuri_refresh", res.refreshToken);
      setUser({ ...res.user, profile_photo: res.user.profile_photo ?? null });
      setActiveSchool(res.school);
      // Reload page to re-fetch all datasets under new school
      window.location.reload();
    } catch (err) {
      // Local fallback switch if in demo mode or offline
      const matched = schoolsList.find((s) => s.id === schoolId);
      if (matched && user) {
        const updatedUser = { ...user, school_id: schoolId };
        setUser(updatedUser);
        setActiveSchool(matched);
        localStorage.setItem("ishuri_demo_user", JSON.stringify(updatedUser));
        window.location.reload();
      } else {
        throw err;
      }
    }
  }, [schoolsList, user]);

  const logout = useCallback(() => {
    auth.logout().catch(() => {});
    localStorage.removeItem("ishuri_token");
    localStorage.removeItem("ishuri_refresh");
    localStorage.removeItem("ishuri_demo");
    localStorage.removeItem("ishuri_demo_user");
    localStorage.removeItem("knotty_token");
    localStorage.removeItem("knotty_refresh");
    localStorage.removeItem("knotty_demo");
    localStorage.removeItem("knotty_demo_user");
    setUser(null);
    setActiveSchool(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      activeSchool,
      schoolsList,
      loading,
      login,
      logout,
      switchSchool,
      refreshSchools: fetchSchools,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
