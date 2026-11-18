"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, MessageSquare } from "lucide-react";
import {
  portalService,
  setPortalToken,
  getPortalToken,
} from "@/lib/supabase/services/portalService";

export default function PortalLoginPage() {
  const router = useRouter();
  const [schoolCode, setSchoolCode] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getPortalToken();
    if (token) {
      portalService.validateSession(token).then((s) => {
        if (s) router.replace("/portal/dashboard");
        else setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, session } = await portalService.login(schoolCode, admissionNumber, pin);
      setPortalToken(token);
      if (session.must_change_pin) {
        router.replace("/portal/dashboard?change_pin=1");
      } else {
        router.replace("/portal/dashboard");
      }
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Student Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Appointments & Support Requests</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">School Code</label>
              <input
                type="text"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                placeholder="e.g. ISH-001"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono tracking-widest"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Admission Number</label>
              <input
                type="text"
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value.toUpperCase())}
                placeholder="e.g. STU-001"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">PIN</label>
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your PIN"
                  required
                  inputMode="numeric"
                  className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 pt-2">
            Forgot your PIN? Contact your school admin to reset it.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          IshuriHUB · Student & Parent Portal
        </p>
      </div>
    </div>
  );
}
