"use client";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { auth, multiSchool, LoginResponse, SchoolItem } from "@/lib/api";
import { DEMO_ACCOUNTS, DEMO_SCHOOL_ID, getAllDemoAccounts } from "@/lib/demo";
import { isSupabaseConfigured, getSafeBrowserClient } from "@/lib/supabase/client";

type User = LoginResponse["user"];

interface AuthContextValue {
  user: User | null;
  activeSchool: SchoolItem | null;
  schoolsList: SchoolItem[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
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

    let authSubscription: { unsubscribe: () => void } | null = null;

    if (isSupabaseConfigured()) {
      const client = getSafeBrowserClient();
      if (client) {
        client.auth.getSession().then(({ data: { session } }) => {
          if (session?.access_token) {
            localStorage.setItem("ishuri_token", session.access_token);
            if (session.refresh_token) {
              localStorage.setItem("ishuri_refresh", session.refresh_token);
            }
          }
        }).catch(() => {});

        const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
          if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
            localStorage.setItem("ishuri_token", session.access_token);
            if (session.refresh_token) {
              localStorage.setItem("ishuri_refresh", session.refresh_token);
            }

            try {
              const { data: personData } = await client
                .from("persons")
                .select("id, status")
                .eq("auth_user_id", session.user.id)
                .maybeSingle();

              let role = "STUDENT";
              let targetSchoolId = DEMO_SCHOOL_ID;

              if (personData) {
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
                    .select("role_key")
                    .eq("membership_id", memberData.id)
                    .limit(1)
                    .maybeSingle();

                  if (roleData?.role_key) {
                    role = roleData.role_key;
                  }
                }
              }

              const userMeta = (session.user.user_metadata || {}) as Record<string, any>;
              const fullName = userMeta.full_name || userMeta.name || "";
              const nameParts = fullName.split(" ");
              const firstName = userMeta.first_name || nameParts[0] || session.user.email?.split("@")[0] || "User";
              const lastName = userMeta.last_name || nameParts.slice(1).join(" ") || "";
              const profilePhoto = userMeta.avatar_url || userMeta.picture || null;

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
            } catch (err) {
              console.error("Error resolving Supabase session membership:", err);
            }
          } else if (event === "SIGNED_OUT") {
            setUser(null);
          }
        });
        authSubscription = subscription;
      }
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

    return () => {
      authSubscription?.unsubscribe();
    };
  }, [fetchSchools]);

  const login = useCallback(async (email: string, password: string) => {
    const normEmail = email.trim().toLowerCase();

    // 1. If Supabase is configured, try Supabase Auth first
    if (isSupabaseConfigured()) {
      const client = getSafeBrowserClient();
      if (client) {
        try {
          const { data, error: supaErr } = await client.auth.signInWithPassword({
            email: normEmail,
            password,
          });

          if (!supaErr && data?.user) {
            // Attempt to resolve person and membership in the database
            const { data: personData } = await client
              .from("persons")
              .select("id, status")
              .eq("auth_user_id", data.user.id)
              .maybeSingle();

            if (personData) {
              const { data: memberData } = await client
                .from("school_memberships")
                .select("id, school_id, status")
                .eq("person_id", personData.id)
                .eq("status", "active")
                .maybeSingle();

              const { data: roleData } = memberData
                ? await client
                    .from("school_membership_roles")
                    .select("role_key")
                    .eq("membership_id", memberData.id)
                    .limit(1)
                    .maybeSingle()
                : { data: null };

              const role = roleData?.role_key || "ADMIN";
              const targetSchoolId = memberData?.school_id || DEMO_SCHOOL_ID;
              const userMeta = (data.user.user_metadata || {}) as Record<string, any>;

              const loggedUser: User = {
                id: data.user.id,
                role,
                school_id: targetSchoolId,
                first_name: userMeta.first_name || data.user.email?.split("@")[0] || "User",
                last_name: userMeta.last_name || "",
                email: data.user.email || normEmail,
                profile_photo: null,
              };

              localStorage.setItem("ishuri_user", JSON.stringify(loggedUser));
              if (data.session?.access_token) {
                localStorage.setItem("ishuri_token", data.session.access_token);
              }
              if (data.session?.refresh_token) {
                localStorage.setItem("ishuri_refresh", data.session.refresh_token);
              }
              setUser(loggedUser);
              fetchSchools(targetSchoolId);
              return;
            }
          }
        } catch (e) {
          console.warn("Supabase Auth sign-in attempted, checking backend:", e);
        }
      }
    }

    // 2. Fall back to Express API backend login
    try {
      const res = await auth.login(normEmail, password);
      localStorage.setItem("ishuri_token", res.accessToken);
      localStorage.setItem("ishuri_refresh", res.refreshToken);
      localStorage.setItem("ishuri_user", JSON.stringify(res.user));
      setUser(res.user);
      fetchSchools(res.user.school_id);
    } catch (err) {
      // 3. Offline demonstration persona fallback is strictly development-only
      const isAllowedOfflineEnv =
        process.env.NODE_ENV === "development" &&
        process.env.NEXT_PUBLIC_APP_ENV !== "staging" &&
        process.env.NEXT_PUBLIC_APP_ENV !== "production";

      if (isAllowedOfflineEnv) {
        const allDemo = getAllDemoAccounts();
        const demo = allDemo.find((a) => a.email.toLowerCase() === normEmail);

        if (demo && demo.password === password) {
          console.warn("Using offline demo persona (development only):", normEmail);
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
          return;
        }
      }

      // DO NOT fabricate sessions or elevate arbitrary credentials to ADMIN
      console.error("Authentication failed:", err);
      throw err instanceof Error ? err : new Error("Authentication failed: invalid credentials or service unreachable.");
    }
  }, [fetchSchools]);

  const loginWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured. Google Sign-In requires active Supabase credentials.");
    }
    const client = getSafeBrowserClient();
    if (!client) {
      throw new Error("Failed to initialize Supabase client.");
    }

    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      throw error;
    }
  }, []);

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
    if (isSupabaseConfigured()) {
      getSafeBrowserClient()?.auth.signOut().catch(() => {});
    }
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
      loginWithGoogle,
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
