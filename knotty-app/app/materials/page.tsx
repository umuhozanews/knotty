"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { materials, structure, Material, Class } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, BookOpen, Upload, Trash2, ExternalLink, Search, Plus, X, FileText } from "lucide-react";
import { useToast } from "@/context/ToastContext";

const CAN_UPLOAD = ["ADMIN", "TEACHER"];
const CAN_DELETE = ["ADMIN", "TEACHER"];

function FileTypeIcon({ type }: { type: string }) {
  if (type.includes("pdf")) return <span className="text-red-500 font-bold text-[10px]">PDF</span>;
  if (type.includes("word") || type.includes("doc")) return <span className="text-blue-500 font-bold text-[10px]">DOC</span>;
  if (type.includes("presentation") || type.includes("ppt")) return <span className="text-orange-500 font-bold text-[10px]">PPT</span>;
  if (type.includes("image")) return <span className="text-green-500 font-bold text-[10px]">IMG</span>;
  return <span className="text-gray-500 font-bold text-[10px]">FILE</span>;
}

export default function MaterialsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const role = user?.role ?? "";

  const [data, setData] = useState<Material[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", description: "", classId: "", levelId: "" });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    load();
    structure.classes().then((r) => setClasses(r.data)).catch(console.error);
  }, [authLoading]);

  function load() {
    setLoading(true);
    materials.list({ classId: filterClass || undefined, search: search || undefined })
      .then((r) => setData(r.data as Material[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (!authLoading) load(); }, [filterClass, authLoading]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !form.title) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", form.title);
      if (form.subject) fd.append("subject", form.subject);
      if (form.description) fd.append("description", form.description);
      if (form.classId) fd.append("classId", form.classId);

      const res = await materials.upload(fd);
      setData((prev) => [res.data, ...prev]);
      setShowUpload(false);
      setForm({ title: "", subject: "", description: "", classId: "", levelId: "" });
      setFile(null);
      toast("Material uploaded successfully", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await materials.remove(id);
      setData((prev) => prev.filter((m) => m.id !== id));
      toast("Deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#121212]">Class Materials</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Notes, slides, and study resources</p>
          </div>
          {CAN_UPLOAD.includes(role) && (
            <button onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#121212] hover:bg-[#dcd9d9] hover:text-[#121212] text-white rounded-lg text-xs font-bold transition duration-200 border border-[#121212]">
              <Plus size={16} />Upload Material
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or subject..."
              className="flex-1 border border-[#dcd9d9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#121212] bg-[#ffffff]" />
            <button type="submit" className="px-3 py-2 rounded-lg border border-[#dcd9d9] bg-[#ffffff] hover:bg-[#fcf9f8] transition">
              <Search size={15} className="text-gray-500" />
            </button>
          </form>
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
            className="border border-[#dcd9d9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#121212] bg-[#ffffff]">
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.level?.name} {c.name}</option>)}
          </select>
        </div>

        {/* Materials grid */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : data.length === 0 ? (
          <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-10 text-center">
            <BookOpen size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm font-medium">No materials uploaded yet</p>
            {CAN_UPLOAD.includes(role) && (
              <button onClick={() => setShowUpload(true)} className="mt-3 text-sm text-[#121212] hover:underline font-bold">Upload the first one</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((m) => (
              <div key={m.id} className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 hover:border-[#dcd9d9] transition duration-200 shadow-none">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#121212]/5 flex items-center justify-center flex-shrink-0 font-bold text-[#121212]">
                    <FileTypeIcon type={m.file_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#121212] truncate tracking-tight">{m.title}</p>
                    <p className="text-xs text-gray-500 font-semibold">{m.subject ?? "General"}</p>
                  </div>
                </div>
                {m.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2 font-medium">{m.description}</p>}
                <div className="flex items-end justify-between border-t border-[#dcd9d9]/50 pt-3">
                  <div>
                    {(m.class || m.level) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-[#dcd9d9] bg-[#fcf9f8] text-[#121212]">
                        {m.level?.name}{m.class ? ` · ${m.class.name}` : ""}
                      </span>
                    )}
                    <p className="text-[10px] text-gray-400 mt-2 font-semibold">By {m.uploader.first_name} {m.uploader.last_name}</p>
                    <p className="text-[10px] text-gray-400 font-mono font-semibold">{new Date(m.created_at).toLocaleDateString("en-GB")}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={m.file_url} target="_blank" rel="noreferrer"
                      className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#dcd9d9] bg-[#ffffff] hover:bg-[#fcf9f8] text-[#121212] transition">
                      <ExternalLink size={13} />
                    </a>
                    {CAN_DELETE.includes(role) && (
                      <button onClick={() => handleDelete(m.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-400 transition">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] w-full max-w-md p-6 shadow-none">
              <div className="flex items-center justify-between mb-4 border-b border-[#dcd9d9] pb-3">
                <p className="text-base font-bold text-[#121212]">Upload Material</p>
                <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <form onSubmit={handleUpload} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Title *</label>
                  <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Integration by Parts Notes"
                    className="w-full border border-[#dcd9d9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#121212] bg-[#ffffff]" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Subject</label>
                    <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="e.g. Mathematics"
                      className="w-full border border-[#dcd9d9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#121212] bg-[#ffffff]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Class</label>
                    <select value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                      className="w-full border border-[#dcd9d9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#121212] bg-[#ffffff]">
                      <option value="">All classes</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.level?.name} {c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Description (optional)</label>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2} placeholder="What's in this file..."
                    className="w-full border border-[#dcd9d9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#121212] bg-[#ffffff] resize-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">File * (PDF, Word, PPT, Image — max 20 MB)</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${file ? "border-[#121212] bg-[#fcf9f8]" : "border-[#dcd9d9] hover:border-[#121212] bg-[#fcf9f8]"}`}
                  >
                    {file ? (
                      <div className="flex items-center gap-2 justify-center">
                        <FileText size={16} className="text-[#121212]" />
                        <span className="text-sm text-[#121212] font-semibold truncate">{file.name}</span>
                      </div>
                    ) : (
                      <div>
                        <Upload size={20} className="mx-auto text-gray-400 mb-1" />
                        <p className="text-sm text-gray-400 font-bold">Click to select file</p>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
                  </div>
                </div>
                <button type="submit" disabled={uploading || !file || !form.title}
                  className="w-full py-3 bg-[#121212] text-white font-bold text-sm hover:bg-[#dcd9d9] hover:text-[#121212] rounded-lg transition border border-[#121212] flex items-center justify-center gap-2 disabled:opacity-50">
                  {uploading ? <><Loader2 size={15} className="animate-spin" />Uploading...</> : <><Upload size={15} />Upload Material</>}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
