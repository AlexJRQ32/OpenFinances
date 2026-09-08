"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { CheckCircleIcon, AlertCircleIcon } from "./icons";

// ── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "destructive";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  leaving: boolean;
}

interface ToastContextValue {
  toast: (opts: { message: string; variant: ToastVariant }) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const ToastCtx = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 2500;
const FADE_OUT_MS = 150;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    // Mark as leaving for fade-out animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, FADE_OUT_MS);
  }, []);

  const toast = useCallback(
    ({ message, variant }: { message: string; variant: ToastVariant }) => {
      const id = nextId.current++;
      setToasts((prev) => {
        const next = [...prev, { id, message, variant, leaving: false }];
        // Keep max 3 — drop oldest
        if (next.length > MAX_TOASTS) {
          return next.slice(next.length - MAX_TOASTS);
        }
        return next;
      });

      // Auto-dismiss
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <Toaster toasts={toasts} />
    </ToastCtx.Provider>
  );
}

// ── Toaster ──────────────────────────────────────────────────────────────────

function Toaster({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed top-[calc(16px+var(--safe-top))] left-1/2 z-[9998] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastCard({ toast: t }: { toast: ToastItem }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isSuccess = t.variant === "success";
  const Icon = isSuccess ? CheckCircleIcon : AlertCircleIcon;
  const iconColor = isSuccess ? "text-income" : "text-expense";
  const messageColor = isSuccess ? "text-foreground" : "text-destructive";

  return (
    <div
      role="status"
      style={{ backgroundColor: "rgba(23,23,27,0.95)", boxShadow: "var(--shadow-card-lg)" }}
      className={`toast-card pointer-events-auto flex w-full items-center gap-3 rounded-xl border border-card-border px-4 py-3 ${
        mounted && !t.leaving ? "is-visible" : ""
      }${t.leaving ? " is-leaving" : ""}`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
      <p className={`flex-1 text-sm font-medium ${messageColor}`}>{t.message}</p>
    </div>
  );
}
