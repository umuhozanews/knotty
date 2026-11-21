"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";

function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim()); }

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    schoolName: "", schoolEmail: "", adminName: "", adminEmail: "", password: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.schoolName.trim().length < 3) return setError("School name must be at least 3 characters.");
    if (!isValidEmail(form.schoolEmail)) return setError("Enter a valid school email address.");
    if (form.adminName.trim().split(/\s+/).length < 2) return setError("Enter your first and last name.");
    if (!isValidEmail(form.adminEmail)) return setError("Enter a valid admin email address.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/schools/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name: form.schoolName.trim(),
          school_email: form.schoolEmail.trim().toLowerCase(),
          admin_name: form.adminName.trim(),
          admin_email: form.adminEmail.trim().toLowerCase(),
          admin_password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#EEF2F7" }}>
        <div className="w-full max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0D3B8E" }}>Application submitted!</h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              A welcome email has been sent to <strong>{form.adminEmail}</strong>. The platform team will review and activate your school — usually within 24 hours.
            </p>
          </div>
          <button onClick={() => router.push("/login")}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-sm"
            style={{ background: "#1976D2" }}>
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden"
        style={{ background: "#EEF2F7" }}>
        {/* Decorative circles */}
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full -translate-y-1/3 -translate-x-1/3"
          style={{ background: "rgba(21,101,192,0.08)" }} />
        <div className="absolute bottom-0 left-16 w-52 h-52 rounded-full translate-y-1/3"
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

          <h1 className="text-4xl font-bold mb-8" style={{ color: "#0D3B8E" }}>Create account</h1>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1.5 block">School Name</label>
              <input value={form.schoolName} onChange={e => set("schoolName", e.target.value)} required
                placeholder="e.g. Kigali International Academy"
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1.5 block">School Email</label>
              <input type="email" value={form.schoolEmail} onChange={e => set("schoolEmail", e.target.value)} required
                placeholder="admin@yourschool.rw"
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1.5 block">Your Full Name</label>
              <input value={form.adminName} onChange={e => set("adminName", e.target.value)} required
                placeholder="e.g. Jean Pierre Mugenzi"
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1.5 block">Your Email</label>
              <input type="email" value={form.adminEmail} onChange={e => set("adminEmail", e.target.value)} required
                placeholder="you@yourschool.rw"
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1.5 block">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} required
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition pr-12" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              style={{ background: "#1976D2" }}>
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? "Submitting…" : "Create Account"}
            </button>
          </form>

          {/* Mobile sign-in link */}
          <p className="md:hidden text-center text-xs text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-blue-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Left panel — CTA */}
      <div className="hidden md:flex md:w-5/12 relative overflow-hidden items-center justify-center"
        style={{ background: "linear-gradient(160deg, #1565C0 0%, #0D3B8E 60%, #072060 100%)" }}>
        <div className="absolute -right-24 top-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full"
          style={{ background: "rgba(0,0,0,0.25)" }} />
        <div className="relative z-10 text-center px-12">
          <h2 className="text-3xl font-bold text-white mb-3">Already have an account?</h2>
          <p className="text-blue-200 text-sm leading-relaxed mb-8">
            Sign in to manage your school's students, fees, attendance and canteen.
          </p>
          <Link href="/login"
            className="inline-block px-8 py-3 rounded-full border-2 border-white text-white font-semibold text-sm hover:bg-white hover:text-blue-900 transition">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
