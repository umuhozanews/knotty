"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Loader2, Building2, UserCheck, ShieldCheck, ChevronDown, Check } from "lucide-react";
import { getAllDemoAccounts, DemoAccount } from "@/lib/demo";

const SCHOOL_TABS = [
  { code: "KMS", name: "IshuriHUB Model" },
  { code: "GHIA", name: "Green Hills" },
  { code: "RHS", name: "Riviera High" },
  { code: "KSS", name: "Kagarama Sec" },
  { code: "LDK", name: "Lycée de Kigali" },
  { code: "GSSF", name: "Sainte Famille" },
  { code: "SOST", name: "SOS Technical" },
];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedSchoolCode, setSelectedSchoolCode] = useState("KMS");
  const [showQuickPicker, setShowQuickPicker] = useState(true);

  const allAccounts = useMemo(() => getAllDemoAccounts(), []);

  // Accounts for selected school
  const currentSchoolAccounts = useMemo(() => {
    return allAccounts.filter((a) => a.school_code === selectedSchoolCode);
  }, [allAccounts, selectedSchoolCode]);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email.trim(), password.trim());
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  const handleSelectAccount = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError("");
  };

  if (loading) {
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
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#FFF3EC" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#FF7A22" />
              <path d="M2 17l10 5 10-5" stroke="#FF7A22" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="#FFB800" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-gray-800">IshuriHUB</span>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-1">Welcome back</h1>
          <p className="text-xs text-gray-400 mb-5">Sign in to your school management or staff portal</p>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
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
                placeholder="staff@ishurihub.rw"
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
              className="w-full py-2.5 rounded-xl text-white font-semibold text-xs transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2 shadow-xs"
              style={{ background: "#FF7A22" }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <span>{submitting ? "Signing in…" : "Sign in"}</span>
            </button>
          </form>
        </div>

        {/* ── Multi-School & Worker Account Quick-Select Panel ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Building2 size={15} style={{ color: "#FF7A22" }} />
              <span className="text-xs font-bold text-gray-800">
                School Management & Worker Accounts
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickPicker((v) => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium"
            >
              {showQuickPicker ? "Hide" : "Show All"}
            </button>
          </div>

          {showQuickPicker && (
            <div className="space-y-3 pt-1 border-t border-gray-100">
              {/* School Tabs */}
              <div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">
                  1. Select School Node
                </span>
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {SCHOOL_TABS.map((tab) => {
                    const isSel = selectedSchoolCode === tab.code;
                    return (
                      <button
                        key={tab.code}
                        type="button"
                        onClick={() => setSelectedSchoolCode(tab.code)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition ${
                          isSel
                            ? "bg-[#FFF3EC] text-[#FF7A22] border border-[#FFD4B2]"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"
                        }`}
                      >
                        {tab.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Roles for selected school */}
              <div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">
                  2. Choose Account to Sign In As
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {currentSchoolAccounts.map((acc) => {
                    const isCurrent = email === acc.email;
                    return (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleSelectAccount(acc)}
                        className={`flex items-center justify-between p-2 rounded-xl text-left text-xs border transition ${
                          isCurrent
                            ? "bg-[#FFF3EC] border-[#FF7A22] text-[#FF7A22]"
                            : "bg-gray-50 border-gray-100 hover:border-gray-300 text-gray-700"
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <p className="font-semibold truncate">
                            {acc.role === "ADMIN" ? "Management (Admin)" : acc.role}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {acc.first_name} {acc.last_name}
                          </p>
                        </div>
                        {isCurrent && <Check size={13} className="shrink-0" style={{ color: "#FF7A22" }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 text-center">
                <p className="text-[11px] text-gray-400">
                  Click any account above to populate credentials, then click <span className="font-semibold text-gray-700">Sign in</span>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
