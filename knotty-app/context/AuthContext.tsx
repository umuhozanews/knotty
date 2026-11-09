"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, getSafeBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type User = {
  id: string;
  role: string;
  school_id: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo: string | null;
};

type SchoolItem = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string | null;
  address: string | null;
  subscription_plan: string;
  student_count: number;
  worker_count: number;
  class_count: number;
  canteen_products_count: number;
};

interface AuthContextValue {
  user: User | null;
  activeSchool: SchoolItem | null;
  schoolsList: SchoolItem[];
  loading: boolean;
  login: (email: string, password: string) => Promise<string>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  switchSchool: (schoolId: string) => Promise<void>;
  refreshSchools: () => Promise<void>;
}

export function getDashboardPath(role: string): string {
  if (role === "STUDENT") return "/my-dashboard";
  if (role === "LIBRARIAN") return "/library";
  return "/";
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildSchoolItem(row: { id: string; name: string; code: string; email: string; phone: string | null; address: string | null }): SchoolItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? "",
    email: row.email ?? "",
    phone: row.phone ?? null,
    address: row.address ?? null,
    subscription_plan: "PREMIUM",
    student_count: 0,
    worker_count: 0,
    class_count: 0,
    canteen_products_count: 0,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("ishuri_user");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [activeSchool, setActiveSchool] = useState<SchoolItem | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("ishuri_active_school");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [schoolsList, setSchoolsList] = useState<SchoolItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);

  const fetchSchools = useCallback(async (targetSchoolId?: string) => {
    if (!isSupabaseConfigured()) return;
    const client = getSafeBrowserClient();
    if (!client) return;

    const schoolId = targetSchoolId || user?.school_id;

    try {
      if (schoolId) {
        // Single-school staff: load their specific school
        const { data } = await client
          .from("schools")
          .select("id, name, code, email, phone, address")
          .eq("id", schoolId)
          .maybeSingle();

        if (data) {
          const school = buildSchoolItem(data);
          setSchoolsList([school]);
          setActiveSchool(school);
          try { localStorage.setItem("ishuri_active_school", JSON.stringify(school)); } catch {}
        }
      } else {
        // Platform admin with no school_id: load all schools in the org
        const { data } = await client
          .from("schools")
          .select("id, name, code, email, phone, address")
          .eq("organization_id", "00000000-0000-0000-0000-000000000001")
          .order("name");

        if (data && data.length > 0) {
          const schools = data.map(buildSchoolItem);
          setSchoolsList(schools);
          // Try to restore previously active school
          try {
            const saved = localStorage.getItem("ishuri_active_school");
            if (saved) {
              const savedSchool = JSON.parse(saved) as SchoolItem;
              const match = schools.find((s) => s.id === savedSchool.id);
              if (match) { setActiveSchool(match); return; }
            }
          } catch {}
          // Default to first school
          setActiveSchool(schools[0]);
          try { localStorage.setItem("ishuri_active_school", JSON.stringify(schools[0])); } catch {}
        }
      }
    } catch (err) {
      console.error("Failed to fetch school data:", err);
    }
  }, [user?.school_id]);

  const clearAuth = useCallback(() => {
    try {
      localStorage.removeItem("ishuri_user");
      localStorage.removeItem("ishuri_token");
      localStorage.removeItem("ishuri_refresh");
      localStorage.removeItem("ishuri_active_school");
    } catch {}
    setUser(null);
    setActiveSchool(null);
    setLoading(false);
  }, []);

  const resolveUserFromSession = useCallback(
    async (client: SupabaseClient<Database>, session: Session): Promise<User | null> => {
      try {
        localStorage.setItem("ishuri_token", session.access_token);
        if (session.refresh_token) localStorage.setItem("ishuri_refresh", session.refresh_token);

        const { data: personData } = await client
          .from("persons")
          .select("id, status")
          .eq("auth_user_id", session.user.id)
          .maybeSingle();

        let role = "";
        let targetSchoolId = "";

        if (personData?.status === "active") {
          const { data: memberData } = await client
            .from("school_memberships")
            .select("id, school_id, status")
            .eq("person_id", personData.id)
            .eq("status", "active")
            .maybeSingle();

          if (memberData) {
            targetSchoolId = memberData.school_id;
            const { data: roleData } = await client
              .from("school_membership_roles")
              .select("role_key, status")
              .eq("membership_id", memberData.id)
              .eq("status", "active")
              .limit(1)
              .maybeSingle();

            if (roleData?.role_key) role = roleData.role_key;
          }
        }

        if (!role || !targetSchoolId) {
          clearAuth();
          window.setTimeout(() => { void client.auth.signOut(); }, 0);
          return null;
        }

        const userMeta = (session.user.user_metadata || {}) as Record<string, unknown>;
        const fullName = (userMeta.full_name as string) || (userMeta.name as string) || "";
        const nameParts = fullName.split(" ");
        const firstName = (userMeta.first_name as string) || nameParts[0] || session.user.email?.split("@")[0] || "User";
        const lastName = (userMeta.last_name as string) || nameParts.slice(1).join(" ") || "";
        const profilePhoto = (userMeta.avatar_url as string) || (userMeta.picture as string) || null;

        const loggedUser: User = {
          id: session.user.id,
          role,
          school_id: targetSchoolId,
          first_name: firstName,
          last_name: lastName,
          email: session.user.email || "",
          profile_photo: profilePhoto,
        };

        localStorage.setItem("ishuri_user", JSON.stringify(loggedUser));
        setUser(loggedUser);
        fetchSchools(targetSchoolId);
        setLoading(false);
        return loggedUser;
      } catch (err) {
        console.error("Error resolving Supabase session membership:", err);
        setLoading(false);
        return null;
      }
    },
    [clearAuth, fetchSchools]
  );

  useEffect(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;

    if (isSupabaseConfigured()) {
      const client = getSafeBrowserClient();
      if (client) {
        // Subscribe to auth state changes
        const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
          if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session) {
            await resolveUserFromSession(client, session);
          } else if (event === "SIGNED_OUT" || !session) {
            clearAuth();
          }
        });
        authSubscription = subscription;

        // Also proactively check session state
        client.auth.getSession().then(async ({ data: { session } }) => {
          if (session) {
            await resolveUserFromSession(client, session);
          } else {
            const storedToken = localStorage.getItem("ishuri_token");
            const storedRefresh = localStorage.getItem("ishuri_refresh");
            if (storedToken && storedRefresh) {
              try {
                const { data: res } = await client.auth.setSession({
                  access_token: storedToken,
                  refresh_token: storedRefresh,
                });
                if (res?.session) {
                  await resolveUserFromSession(client, res.session);
                  return;
                }
              } catch {}
            }
            clearAuth();
          }
        }).catch(() => {
          clearAuth();
        });
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    return () => { authSubscription?.unsubscribe(); };
  }, [fetchSchools, clearAuth, resolveUserFromSession]);

  const login = useCallback(async (email: string, password: string) => {
    const normEmail = email.trim().toLowerCase();

    if (!isSupabaseConfigured()) throw new Error("Authentication is not configured. Please contact support.");
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Failed to initialize auth client.");

    const { data, error: supaErr } = await client.auth.signInWithPassword({ email: normEmail, password });
    if (supaErr || !data?.user) throw new Error("Invalid email or password. Please check your credentials.");

    const { data: personData } = await client
      .from("persons")
      .select("id, status")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    let role = "";
    let targetSchoolId = "";

    if (personData?.status === "active") {
      const { data: memberData } = await client
        .from("school_memberships")
        .select("id, school_id, status")
        .eq("person_id", personData.id)
        .eq("status", "active")
        .maybeSingle();

      if (memberData) {
        targetSchoolId = memberData.school_id;
        const { data: roleData } = await client
          .from("school_membership_roles")
          .select("role_key, status")
          .eq("membership_id", memberData.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (roleData?.role_key) role = roleData.role_key;
      }
    }

    if (!role || !targetSchoolId) {
      await client.auth.signOut();
      throw new Error("Your account does not have an active school role. Contact your school administrator.");
    }

    const userMeta = (data.user.user_metadata || {}) as Record<string, unknown>;
    const loggedUser: User = {
      id: data.user.id,
      role,
      school_id: targetSchoolId,
      first_name: (userMeta.first_name as string) || data.user.email?.split("@")[0] || "User",
      last_name: (userMeta.last_name as string) || "",
      email: data.user.email || normEmail,
      profile_photo: null,
    };

    localStorage.setItem("ishuri_user", JSON.stringify(loggedUser));
    if (data.session?.access_token) localStorage.setItem("ishuri_token", data.session.access_token);
    if (data.session?.refresh_token) localStorage.setItem("ishuri_refresh", data.session.refresh_token);
    setUser(loggedUser);
    fetchSchools(targetSchoolId);

    // Log the login event (best-effort, non-blocking)
    if (targetSchoolId) {
      void Promise.resolve(client.rpc("log_staff_session" as never, {
        p_school_id: targetSchoolId,
        p_auth_user_id: data.user.id,
        p_event_type: "login",
      } as never)).catch(() => {});
    }

    return role;
  }, [fetchSchools]);

  const loginWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured. Google Sign-In requires active Supabase credentials.");
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Failed to initialize Supabase client.");

    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) throw error;

    if (data?.url) {
      try {
        const check = await fetch(data.url, { method: "GET", redirect: "manual" });
        if (check.status === 400) {
          const body = await check.json().catch(() => null);
          if (body?.msg?.includes("not enabled") || body?.error_code === "validation_failed") {
            throw new Error("Google Sign-In is not enabled yet in this Supabase project. Please configure Google OAuth Client ID & Secret in Supabase, or sign in with email and password.");
          }
        }
      } catch (checkErr) {
        if (checkErr instanceof Error && checkErr.message.includes("Google Sign-In is not enabled")) throw checkErr;
      }
      if (typeof window !== "undefined") window.location.href = data.url;
    }
  }, []);

  const switchSchool = useCallback(async (schoolId: string) => {
    if (!isSupabaseConfigured()) return;
    const client = getSafeBrowserClient();
    if (!client || !user) return;

    const { data } = await client
      .from("schools")
      .select("id, name, code, email, phone, address")
      .eq("id", schoolId)
      .maybeSingle();

    if (data) {
      const school = buildSchoolItem(data);
      const updatedUser = { ...user, school_id: schoolId };
      setUser(updatedUser);
      setActiveSchool(school);
      setSchoolsList([school]);
      try {
        localStorage.setItem("ishuri_user", JSON.stringify(updatedUser));
        localStorage.setItem("ishuri_active_school", JSON.stringify(school));
      } catch {}
      window.location.reload();
    }
  }, [user]);

  const logout = useCallback(() => {
    // Log the logout event (best-effort, non-blocking)
    if (isSupabaseConfigured() && user?.school_id && user?.id) {
      const client = getSafeBrowserClient();
      void Promise.resolve(client?.rpc("log_staff_session" as never, {
        p_school_id: user.school_id,
        p_auth_user_id: user.id,
        p_event_type: "logout",
      } as never)).catch(() => {});
    }
    if (isSupabaseConfigured()) getSafeBrowserClient()?.auth.signOut().catch(() => {});
    ["ishuri_token", "ishuri_refresh", "ishuri_user", "ishuri_active_school", "ishuri_demo",
     "ishuri_demo_user", "knotty_token", "knotty_refresh", "knotty_demo", "knotty_demo_user"]
      .forEach(k => { try { localStorage.removeItem(k); } catch {} });
    setUser(null);
    setActiveSchool(null);
  }, [user?.school_id, user?.id]);

  return (
    <AuthContext.Provider value={{
      user, activeSchool, schoolsList, loading,
      login, loginWithGoogle, logout, switchSchool,
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
