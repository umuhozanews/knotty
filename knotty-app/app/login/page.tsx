"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getDashboardPath } from "@/context/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);
  useEffect(() => {
    if (!loading && user) router.replace(getDashboardPath(user.role));
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password.trim());
      if (result.startsWith("__change_password__:")) {
        router.replace("/change-password");
      } else {
        router.replace(getDashboardPath(result));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please check your email and password.");
      setSubmitting(false);
    }
  }

  if (!isMounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden md:flex md:w-5/12 relative overflow-hidden items-center justify-center"
        style={{ background: "linear-gradient(160deg, #1565C0 0%, #0D3B8E 60%, #072060 100%)" }}>
        {/* Big decorative circle */}
        <div className="absolute -left-24 top-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full"
          style={{ background: "rgba(0,0,0,0.25)" }} />
        <div className="relative z-10 text-center px-12">
          <h2 className="text-3xl font-bold text-white mb-3">New here?</h2>
          <p className="text-blue-200 text-sm leading-relaxed mb-8">
            Register your school to start managing students, fees, attendance and canteen — all in one place.
          </p>
          <Link href="/register"
            className="inline-block px-8 py-3 rounded-full border-2 border-white text-white font-semibold text-sm hover:bg-white hover:text-blue-900 transition">
            Sign up
          </Link>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden"
        style={{ background: "#EEF2F7" }}>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full -translate-y-1/3 translate-x-1/3"
          style={{ background: "rgba(21,101,192,0.08)" }} />
        <div className="absolute bottom-0 right-16 w-52 h-52 rounded-full translate-y-1/3"
          style={{ background: "rgba(21,101,192,0.06)" }} />

        <div className="relative z-10 w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#DCFCE7" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#16A34A" />
                <path d="M2 17l10 5 10-5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
                <path d="M2 12l10 5 10-5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-700">IshuriHUB</span>
          </div>

          <h1 className="text-4xl font-bold mb-8" style={{ color: "#0D3B8E" }}>Welcome back</h1>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1.5 block">E-mail</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="E-mail"
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition pr-12"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              style={{ background: "#1976D2" }}
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? "Signing in…" : "Log in"}
            </button>
          </form>

          {/* Mobile sign-up link */}
          <p className="md:hidden text-center text-xs text-gray-500 mt-6">
            New school?{" "}
            <Link href="/register" className="font-semibold text-blue-600 hover:underline">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
