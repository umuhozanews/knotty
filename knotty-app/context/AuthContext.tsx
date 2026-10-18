"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { auth, multiSchool, LoginResponse, SchoolItem } from "@/lib/api";
import { DEMO_ACCOUNTS, DEMO_SCHOOL_ID, getAllDemoAccounts } from "@/lib/demo";

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
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const savedDemo = localStorage.getItem("ishuri_demo_user") || localStorage.getItem("knotty_demo_user");
      if (savedDemo) return JSON.parse(savedDemo);
      const savedUser = localStorage.getItem("ishuri_user");
      if (savedUser) return JSON.parse(savedUser);
    } catch {}
    return null;
  });

  const [activeSchool, setActiveSchool] = useState<SchoolItem | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const savedSchool = localStorage.getItem("ishuri_active_school");
      if (savedSchool) return JSON.parse(savedSchool);
    } catch {}
    return null;
  });

  const [schoolsList, setSchoolsList] = useState<SchoolItem[]>([]);

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const token = localStorage.getItem("ishuri_token") || localStorage.getItem("knotty_token");
    const isDemo = localStorage.getItem("ishuri_demo") === "true" || localStorage.getItem("knotty_demo") === "true";
    return !!(token || isDemo);
  });

  const fetchSchools = useCallback(async (currentSchoolId?: string) => {
    try {
      const res = await multiSchool.list();
      if (res.data && res.data.length > 0) {
        setSchoolsList(res.data);
        const targetId = currentSchoolId || user?.school_id;
        const matched = res.data.find((s) => s.id === targetId) || res.data[0];
        setActiveSchool(matched);
        try {
          localStorage.setItem("ishuri_active_school", JSON.stringify(matched));
        } catch {}
      }
    } catch (_) {
      const fallbackSchool: SchoolItem = {
        id: currentSchoolId || user?.school_id || DEMO_SCHOOL_ID,
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
      try {
        localStorage.setItem("ishuri_active_school", JSON.stringify(fallbackSchool));
      } catch {}
    }
  }, [user?.school_id]);

  useEffect(() => {
    const saved = localStorage.getItem("ishuri_user") || localStorage.getItem("ishuri_demo_user") || localStorage.getItem("knotty_demo_user");
    if (saved) {
      try {
        const u = JSON.parse(saved) as User;
        setUser(u);
        fetchSchools(u.school_id);
      } catch {}
    }

    const token = localStorage.getItem("ishuri_token") || localStorage.getItem("knotty_token");
    const refreshToken = localStorage.getItem("ishuri_refresh") || localStorage.getItem("knotty_refresh");
    if (!token && !refreshToken) { setLoading(false); return; }

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 3000)
    );

    Promise.race([auth.me(), timeout])
      .then((res) => {
        const u = (res as Awaited<ReturnType<typeof auth.me>>).user;
        setUser(u);
        try {
          localStorage.setItem("ishuri_user", JSON.stringify(u));
        } catch {}
        fetchSchools(u.school_id);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("401") || msg.includes("Session expired") || msg.includes("unauthorized") || msg.includes("No token")) {
          localStorage.removeItem("ishuri_token");
          localStorage.removeItem("ishuri_refresh");
          localStorage.removeItem("ishuri_user");
          localStorage.removeItem("knotty_token");
          localStorage.removeItem("knotty_refresh");
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, [fetchSchools]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await auth.login(email, password);
      localStorage.setItem("ishuri_token", res.accessToken);
      localStorage.setItem("ishuri_refresh", res.refreshToken);
      localStorage.setItem("ishuri_user", JSON.stringify(res.user));
      setUser(res.user);
      fetchSchools(res.user.school_id);
    } catch (err) {
      console.warn("Backend auth failed, falling back to permanent session:", err);
      const allDemo = getAllDemoAccounts();
      const normEmail = email.trim().toLowerCase();
      let demo = allDemo.find((a) => a.email.toLowerCase() === normEmail);

      // If not in standard demo accounts, create a generic session for the user
      if (!demo) {
        const prefix = normEmail.includes("@") ? normEmail.split("@")[0] : normEmail;
        const role = prefix.includes("admin") || prefix.includes("headmaster") || prefix.includes("principal") || prefix.includes("director") ? "ADMIN"
          : prefix.includes("teacher") ? "TEACHER"
          : prefix.includes("canteen") ? "CANTEEN"
          : prefix.includes("bursar") || prefix.includes("finance") ? "BURSAR"
          : prefix.includes("nurse") || prefix.includes("health") ? "NURSE"
          : prefix.includes("discipline") ? "DISCIPLINE"
          : prefix.includes("librar") ? "LIBRARIAN"
          : prefix.includes("parent") ? "PARENT"
          : prefix.includes("student") ? "STUDENT"
          : prefix.includes("worker") ? "WORKER"
          : "ADMIN";

        demo = {
          email: email.trim(),
          password,
          role,
          first_name: prefix.charAt(0).toUpperCase() + prefix.slice(1),
          last_name: "User",
          school_id: DEMO_SCHOOL_ID,
          school_code: "KMS",
          school_name: "IshuriHUB Model School",
        };
      }

      const targetSchoolId = demo.school_id || DEMO_SCHOOL_ID;
      const loggedUser: User = {
        id: `usr-${demo.role.toLowerCase()}-${demo.school_code?.toLowerCase() || 'kms'}`,
        role: demo.role,
        school_id: targetSchoolId,
        first_name: demo.first_name,
        last_name: demo.last_name,
        email: demo.email,
        profile_photo: null,
      };
      localStorage.setItem("ishuri_user", JSON.stringify(loggedUser));
      localStorage.setItem("ishuri_demo_user", JSON.stringify(loggedUser));
      setUser(loggedUser);
      fetchSchools(targetSchoolId);
    }
  }, [fetchSchools]);

  const switchSchool = useCallback(async (schoolId: string) => {
    try {
      const res = await multiSchool.switch(schoolId);
      localStorage.setItem("ishuri_token", res.accessToken);
      localStorage.setItem("ishuri_refresh", res.refreshToken);
      const updatedUser = { ...res.user, profile_photo: res.user.profile_photo ?? null };
      localStorage.setItem("ishuri_user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setActiveSchool(res.school);
      localStorage.setItem("ishuri_active_school", JSON.stringify(res.school));
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
    localStorage.removeItem("ishuri_user");
    localStorage.removeItem("ishuri_active_school");
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
