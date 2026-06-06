"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const DEMO_ACCOUNTS = [
  { email: "admin@knottyschool.rw",       password: "Admin@2024",   role: "ADMIN",      first_name: "School",   last_name: "Admin"  },
  { email: "teacher@knottyschool.rw",     password: "Staff@2024",   role: "TEACHER",    first_name: "Kagabo",   last_name: "Robert" },
  { email: "bursar@knottyschool.rw",      password: "Staff@2024",   role: "BURSAR",     first_name: "Nshimiye", last_name: "Paul"   },
  { email: "nurse@knottyschool.rw",       password: "Staff@2024",   role: "NURSE",      first_name: "Mutoni",   last_name: "Diane"  },
  { email: "discipline@knottyschool.rw",  password: "Staff@2024",   role: "DISCIPLINE", first_name: "Rugamba",  last_name: "Victor" },
  { email: "canteen@knottyschool.rw",     password: "Staff@2024",   role: "CANTEEN",    first_name: "Umutoni",  last_name: "Claire" },
  { email: "hirwa.jean@knotty.rw",        password: "Student@2024", role: "STUDENT",    first_name: "Hirwa",    last_name: "Jean"   },
];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    // Demo credentials — bypass the backend entirely
    const demo = DEMO_ACCOUNTS.find((a) => a.email === email && a.password === password);
    if (demo) {
      const demoUser = {
        id: `demo-${demo.role.toLowerCase()}`,
        role: demo.role,
        school_id: "demo-school-id",
        first_name: demo.first_name,
        last_name: demo.last_name,
        email: demo.email,
        profile_photo: null,
      };
      localStorage.setItem("knotty_demo", "true");
      localStorage.setItem("knotty_demo_user", JSON.stringify(demoUser));
      // Hard reload so AuthContext re-runs and picks up the new localStorage state
      window.location.replace("/");
      return;
    }

    // Real login (only used when backend is running)
    try {
      await login(email, password);
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-[#e8f5e9] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#2e7d32" />
              <path d="M2 17l10 5 10-5" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-gray-800">KNOTTY</span>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-8">
          <h1 className="text-xl font-bold text-gray-800 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-400 mb-6">Sign in to your school dashboard</p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@knottyschool.rw"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition bg-gray-50"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition bg-gray-50 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-4">
            Demo: <span className="font-mono">admin@knottyschool.rw</span> / <span className="font-mono">Admin@2024</span>
          </p>
        </div>
      </div>
    </div>
  );
}
