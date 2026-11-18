"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getDashboardPath } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function ChangePasswordPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) throw new Error("Auth client unavailable.");
      const { error: updateErr } = await client.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });
      if (updateErr) throw new Error(updateErr.message);
      setDone(true);
      setTimeout(() => {
        router.replace(getDashboardPath(user!.role));
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4 py-8">
      <div className="w-full max-w-md space-y-4">
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

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-gray-800 mb-1">Password Updated</h2>
              <p className="text-sm text-gray-500">Redirecting you to your dashboard…</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-800 mb-1">Set a new password</h1>
              <p className="text-xs text-gray-400 mb-5">
                Your account was set up with a temporary password. Please choose a new one to continue.
              </p>

              {error && (
                <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 leading-relaxed">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    New Password <span className="text-gray-400 font-normal">(min 8 characters)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Enter new password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500 transition bg-white pr-10"
                    />
                    <button type="button" onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repeat new password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500 transition bg-white pr-10"
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
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
                  <span>{submitting ? "Saving…" : "Save New Password"}</span>
                </button>
              </form>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 pt-2">
          <ShieldCheck size={14} className="text-gray-400" />
          <span>Single-school isolated deployment &middot; Row Level Security</span>
        </div>
      </div>
    </div>
  );
}
