"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getDashboardPath } from "@/context/AuthContext";
// loginWithGoogle kept in AuthContext for future use
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace(getDashboardPath(user.role));
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const role = await login(email.trim(), password.trim());
      router.replace(getDashboardPath(role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please verify your email and password.");
      setSubmitting(false);
    }
  }

  if (!isMounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Logo */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#DCFCE7" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#16A34A" />
              <path d="M2 17l10 5 10-5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-gray-800">IshuriHUB</span>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-1">Sign in to your school</h1>
          <p className="text-xs text-gray-400 mb-5">Enter your account credentials or continue with Google</p>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                Email Address or Username
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your.email@school.rw"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500 transition bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500 transition bg-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl text-white font-semibold text-xs transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2 shadow-xs cursor-pointer"
              style={{ background: "#16A34A" }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <span>{submitting ? "Signing in…" : "Sign in"}</span>
            </button>
          </form>
        </div>

        {/* Single-School Security Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pt-2">
          <ShieldCheck size={14} className="text-gray-400" />
          <span>Single-school isolated deployment &middot; Row Level Security</span>
        </div>
      </div>
    </div>
  );
}
