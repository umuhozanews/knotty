"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, AlertCircle, Loader2 } from "lucide-react";
import {
  portalService, getPortalToken,
} from "@/lib/supabase/services/portalService";

const CATEGORIES = [
  { value: "billing",     label: "Billing & Fees" },
  { value: "discipline",  label: "Discipline" },
  { value: "academic",    label: "Academic" },
  { value: "health",      label: "Health" },
  { value: "card_nfc",    label: "Card / NFC" },
  { value: "gate_access", label: "Gate Access" },
  { value: "library",     label: "Library" },
  { value: "general",     label: "General" },
];

const PRIORITIES = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function NewRequestPage() {
  const router = useRouter();
  const [type, setType] = useState<"appointment" | "challenge">("challenge");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("medium");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!subject.trim() || !body.trim()) {
      setError("Subject and description are required");
      return;
    }
    const token = getPortalToken();
    if (!token) { router.replace("/portal"); return; }

    setSubmitting(true);
    try {
      const id = await portalService.createRequest({
        token,
        type,
        category,
        subject: subject.trim(),
        body: body.trim(),
        priority,
        appointmentRequestedAt: type === "appointment" && appointmentDate
          ? new Date(appointmentDate).toISOString()
          : undefined,
      });
      router.replace(`/portal/request/${id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900 text-sm">New Request</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {/* Request type */}
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Request Type</p>
            <div className="grid grid-cols-2 gap-3">
              {(["appointment", "challenge"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition text-left ${
                    type === t
                      ? t === "appointment"
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    type === t
                      ? t === "appointment" ? "bg-indigo-100" : "bg-orange-100"
                      : "bg-gray-100"
                  }`}>
                    {t === "appointment"
                      ? <Calendar className={`w-4 h-4 ${type === t ? "text-indigo-600" : "text-gray-500"}`} />
                      : <AlertCircle className={`w-4 h-4 ${type === t ? "text-orange-600" : "text-gray-500"}`} />}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${type === t ? (t === "appointment" ? "text-indigo-700" : "text-orange-700") : "text-gray-700"}`}>
                      {t === "appointment" ? "Appointment" : "Challenge"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t === "appointment" ? "Schedule a meeting" : "Report an issue"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Category + Priority */}
          <div className="bg-white rounded-2xl p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium transition text-left ${
                      category === c.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITIES.map((p) => (
                  <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                    className={`py-2 rounded-xl text-xs font-medium transition ${
                      priority === p.value
                        ? p.value === "urgent" ? "bg-red-600 text-white"
                          : p.value === "high" ? "bg-orange-500 text-white"
                          : p.value === "medium" ? "bg-blue-600 text-white"
                          : "bg-gray-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-2xl p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief title of your request"
                required
                maxLength={120}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description *</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Explain the issue or what you need in detail…"
                required
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {type === "appointment" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Preferred Date & Time</label>
                <input
                  type="datetime-local"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Submitting…" : "Submit Request"}
          </button>
        </form>
      </main>
    </div>
  );
}
