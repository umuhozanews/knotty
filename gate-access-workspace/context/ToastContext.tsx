"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface Toast { id: number; type: ToastType; message: string }
interface ToastCtx { toast: (msg: string, type?: ToastType) => void; show: (msg: string, type?: ToastType) => void }

const ToastContext = createContext<ToastCtx>({ toast: () => {}, show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let nextId = 0;

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++nextId;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  function dismiss(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  const icons = { success: CheckCircle, error: XCircle, info: Info };
  const colors = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-700",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };
  const iconColors = { success: "text-green-500", error: "text-red-500", info: "text-blue-500" };

  return (
    <ToastContext.Provider value={{ toast, show: toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl border shadow-lg text-sm font-medium max-w-xs pointer-events-auto animate-in ${colors[t.type]}`}>
              <Icon size={16} className={`mt-0.5 flex-shrink-0 ${iconColors[t.type]}`} />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0">
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
