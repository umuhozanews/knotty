"use client";

import { useState, useMemo } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import {
  SYSTEM_TESTS,
  SystemTestDefinition,
  TestStatus,
  TestCategory,
  SystemTestType,
} from "@/lib/testing/systemTests";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Play,
  RotateCw,
  Download,
  Search,
  Filter,
  ShieldCheck,
  Server,
  Database,
  Lock,
  GraduationCap,
  Users,
  Layers,
  CalendarCheck,
  CreditCard,
  Zap,
  Info,
} from "lucide-react";

const CATEGORY_ICONS: Record<TestCategory, React.ElementType> = {
  "Database Connectivity": Database,
  Authentication: Lock,
  "Tenant Isolation": ShieldCheck,
  "Roles & Permissions": Lock,
  "Student Management": GraduationCap,
  "Staff Workflows": Users,
  "Academic Structure": Layers,
  "Attendance Workflows": CalendarCheck,
  "NFC Card Lifecycle": CreditCard,
  "Edge Functions": Zap,
};

export default function AdminSystemTestsPage() {
  const { user, activeSchool } = useAuth();
  const [tests, setTests] = useState<SystemTestDefinition[]>(() =>
    SYSTEM_TESTS.map((t) => ({ ...t }))
  );
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Statistics
  const stats = useMemo(() => {
    const total = tests.length;
    const passed = tests.filter((t) => t.status === "PASS").length;
    const failed = tests.filter((t) => t.status === "FAIL").length;
    const blocked = tests.filter((t) => t.status === "BLOCKED").length;
    const notRun = tests.filter((t) => t.status === "NOT RUN").length;
    const behavioral = tests.filter((t) => t.testType === "BEHAVIORAL_EXECUTION").length;
    const schema = tests.filter((t) => t.testType === "SCHEMA_EXISTENCE").length;
    const config = tests.filter((t) => t.testType === "CONFIG_CHECK").length;
    const clientCap = tests.filter((t) => t.testType === "CLIENT_CAPABILITY").length;
    return { total, passed, failed, blocked, notRun, behavioral, schema, config, clientCap };
  }, [tests]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(tests.map((t) => t.category)));
    return ["All", ...cats];
  }, [tests]);

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchesCategory =
        selectedCategory === "All" || t.category === selectedCategory;
      const matchesType =
        selectedType === "All" || t.testType === selectedType;
      const matchesSearch =
        searchQuery === "" ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.verifies.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesType && matchesSearch;
    });
  }, [tests, selectedCategory, selectedType, searchQuery]);

  async function runSingleTest(testId: string) {
    setRunningTestId(testId);
    const start = performance.now();
    try {
      const test = tests.find((t) => t.id === testId);
      if (!test) return;

      const result = await test.execute({
        schoolId: activeSchool?.id || user?.school_id,
        userId: user?.id,
        userRole: user?.role,
      });

      const duration = Math.round(performance.now() - start);

      setTests((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                status: result.status,
                errorDetails: result.errorDetails || null,
                outputSummary: result.outputSummary,
                lastExecutedAt: new Date().toISOString(),
                executionDurationMs: duration,
              }
            : t
        )
      );
    } catch (err: any) {
      setTests((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                status: "FAIL",
                errorDetails: err?.message || "Unexpected execution error",
                lastExecutedAt: new Date().toISOString(),
                executionDurationMs: Math.round(performance.now() - start),
              }
            : t
        )
      );
    } finally {
      setRunningTestId(null);
    }
  }

  async function runAllAutomatedTests() {
    setIsRunningAll(true);
    for (const test of tests) {
      if (!test.isAutomated) continue;
      await runSingleTest(test.id);
    }
    setIsRunningAll(false);
  }

  function resetAllTests() {
    setTests(SYSTEM_TESTS.map((t) => ({ ...t })));
  }

  function exportReport() {
    const report = {
      timestamp: new Date().toISOString(),
      testedBy: user ? `${user.first_name} ${user.last_name} (${user.role})` : "Unauthenticated",
      activeSchool: activeSchool?.name ?? "None",
      stats,
      tests: tests.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        testType: t.testType,
        status: t.status,
        verifies: t.verifies,
        isAutomated: t.isAutomated,
        lastExecutedAt: t.lastExecutedAt,
        durationMs: t.executionDurationMs,
        outputSummary: t.outputSummary,
        errorDetails: t.errorDetails,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ishurihub-system-tests-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-orange-100 text-orange-600">
                <Server size={22} />
              </span>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Admin System Testing Center
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Real-time verification of IshuriHUB database, identity, tenant isolation, and Supabase RPC contracts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              title="Download test results as JSON"
            >
              <Download size={14} />
              Export Report
            </button>
            <button
              onClick={resetAllTests}
              disabled={isRunningAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
            >
              <RotateCw size={14} />
              Reset
            </button>
            <button
              onClick={runAllAutomatedTests}
              disabled={isRunningAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF7A22] hover:bg-[#e0681a] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              {isRunningAll ? (
                <>
                  <RotateCw size={14} className="animate-spin" />
                  Running Suite...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Run All Tests
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notice alert */}
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50 flex items-start gap-3">
          <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <p className="font-semibold">
              IshuriHUB Engineering Standard: Honest Verification
            </p>
            <p className="text-blue-700 dark:text-blue-300">
              Statuses reflect actual backend contracts. If local Docker or Supabase services are offline, tests honestly report{" "}
              <span className="font-bold text-amber-700 dark:text-amber-400">BLOCKED</span> or{" "}
              <span className="font-bold text-red-700 dark:text-red-400">FAIL</span> with root cause diagnostics rather than simulated success.
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Tests</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.total}</p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Passed</p>
            <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">{stats.passed}</p>
          </div>
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
            <p className="text-[11px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">Failed</p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-300 mt-1">{stats.failed}</p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Blocked</p>
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-300 mt-1">{stats.blocked}</p>
          </div>
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Not Run</p>
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">{stats.notRun}</p>
          </div>
        </div>

        {/* Verification Depth Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Behavioral Execution</p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400">RPCs & Edge function execution</p>
            </div>
            <span className="text-lg font-extrabold text-emerald-800 dark:text-emerald-300 ml-2">{stats.behavioral}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/50 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Schema Existence</p>
              <p className="text-[10px] text-indigo-700 dark:text-indigo-400">Table & column schema checks</p>
            </div>
            <span className="text-lg font-extrabold text-indigo-800 dark:text-indigo-300 ml-2">{stats.schema}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/70 dark:border-sky-900/50 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-sky-900 dark:text-sky-200">Config & Ping</p>
              <p className="text-[10px] text-sky-700 dark:text-sky-400">Environment & heartbeat ping</p>
            </div>
            <span className="text-lg font-extrabold text-sky-800 dark:text-sky-300 ml-2">{stats.config}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/50 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-purple-900 dark:text-purple-200">Client Capability</p>
              <p className="text-[10px] text-purple-700 dark:text-purple-400">Browser & hardware NFC API</p>
            </div>
            <span className="text-lg font-extrabold text-purple-800 dark:text-purple-300 ml-2">{stats.clientCap}</span>
          </div>
        </div>

        {/* Filters and search */}
        <div className="space-y-2.5">
          {/* Depth / Type filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-bold text-gray-500 mr-1 shrink-0">Test Type:</span>
            {[
              { id: "All", label: "All Types" },
              { id: "BEHAVIORAL_EXECUTION", label: "⚡ Behavioral Execution" },
              { id: "SCHEMA_EXISTENCE", label: "📋 Schema Existence" },
              { id: "CONFIG_CHECK", label: "⚙️ Config Check" },
              { id: "CLIENT_CAPABILITY", label: "📱 Client Capability" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedType === t.id
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-2xs"
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Category pills + search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs font-bold text-gray-500 mr-1 shrink-0">Domain:</span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? "bg-[#FF7A22] text-white shadow-2xs"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search test names..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-[#FF7A22]"
              />
            </div>
          </div>
        </div>

        {/* Tests List */}
        <div className="space-y-3">
          {filteredTests.map((test) => {
            const Icon = CATEGORY_ICONS[test.category] || Server;
            const isRunning = runningTestId === test.id;

            return (
              <div
                key={test.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-2xs hover:border-gray-300 dark:hover:border-gray-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shrink-0 mt-0.5">
                      <Icon size={16} />
                    </span>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {test.name}
                        </h3>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {test.category}
                        </span>
                        <TypeBadge testType={test.testType} />
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            test.isAutomated
                              ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                              : "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300"
                          }`}
                        >
                          {test.isAutomated ? "Automated" : "Manual Verification"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {test.verifies}
                      </p>
                    </div>
                  </div>

                  {/* Status & Action */}
                  <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0">
                    <StatusBadge status={test.status} />

                    <button
                      onClick={() => runSingleTest(test.id)}
                      disabled={isRunning || isRunningAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-50"
                    >
                      {isRunning ? (
                        <>
                          <RotateCw size={12} className="animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Play size={12} />
                          Run
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Execution details */}
                {(test.lastExecutedAt || test.outputSummary || test.errorDetails) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80 text-xs space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-400">
                      <span>
                        Last Run:{" "}
                        {test.lastExecutedAt
                          ? new Date(test.lastExecutedAt).toLocaleString()
                          : "Never"}
                      </span>
                      {test.executionDurationMs !== undefined && (
                        <span>Duration: {test.executionDurationMs}ms</span>
                      )}
                    </div>

                    {test.outputSummary && (
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 font-mono text-[11px] border border-emerald-100 dark:border-emerald-900/30">
                        ✓ {test.outputSummary}
                      </div>
                    )}

                    {test.errorDetails && (
                      <div className="p-2.5 rounded-xl bg-red-50/80 text-red-800 dark:bg-red-950/30 dark:text-red-300 font-mono text-[11px] border border-red-100 dark:border-red-900/30 break-all">
                        ⚠ {test.errorDetails}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: TestStatus }) {
  switch (status) {
    case "PASS":
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
          <CheckCircle2 size={13} />
          PASS
        </span>
      );
    case "FAIL":
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 font-bold text-xs">
          <AlertCircle size={13} />
          FAIL
        </span>
      );
    case "BLOCKED":
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-xs">
          <AlertTriangle size={13} />
          BLOCKED
        </span>
      );
    case "NOT RUN":
    default:
      return (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold text-xs">
          <Clock size={13} />
          NOT RUN
        </span>
      );
  }
}

function TypeBadge({ testType }: { testType: SystemTestType }) {
  switch (testType) {
    case "BEHAVIORAL_EXECUTION":
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
          ⚡ Behavioral Execution
        </span>
      );
    case "SCHEMA_EXISTENCE":
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
          📋 Schema Existence
        </span>
      );
    case "CONFIG_CHECK":
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800/60">
          ⚙️ Config Check
        </span>
      );
    case "CLIENT_CAPABILITY":
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/60">
          📱 Client Capability
        </span>
      );
  }
}
