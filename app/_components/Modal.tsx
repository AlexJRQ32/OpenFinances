"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  role?: "dialog" | "alertdialog";
}

/**
 * Centered dialog modal (all viewports).
 * - Backdrop: fade-in with blur, flex-centered
 * - Panel: scale+opacity entrance, transform/opacity only
 * - Closes on backdrop click and Escape
 * - Locks body scroll while open
 * - Focus trap: moves focus to first input on open, returns to trigger on close
 * - Accessible: role="dialog", aria-modal, labelled by title
 * - Respects prefers-reduced-motion (global rule nullifies transitions)
 */
export default function Modal({ open, onClose, title, children, role = "dialog" }: ModalProps) {
  const [visible, setVisible] = useState(open);
  const [animating, setAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<Element | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Guard against SSR — createPortal only works client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Store the element that triggered the modal for focus return
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
    }
  }, [open]);

  // Handle open/close animation
  useEffect(() => {
    if (open) {
      setVisible(true);
      // Start enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(true);
        });
      });
    } else if (visible) {
      // Trigger exit animation
      setAnimating(false);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open, visible]);

  // Lock body scroll (iOS Safari position:fixed technique — avoids scroll jump)
  useEffect(() => {
    if (!visible) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prevStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      body.style.position = prevStyles.position;
      body.style.top = prevStyles.top;
      body.style.left = prevStyles.left;
      body.style.right = prevStyles.right;
      body.style.width = prevStyles.width;
      body.style.overflow = prevStyles.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [visible]);

  // Focus first input on open
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      el?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [visible]);

  // Return focus on close
  useEffect(() => {
    if (!visible && triggerRef.current) {
      (triggerRef.current as HTMLElement).focus?.();
      triggerRef.current = null;
    }
  }, [visible]);

  // Scroll focused input into view when iOS keyboard opens
  useEffect(() => {
    if (!visible) return;
    const panel = panelRef.current;
    if (!panel) return;
    let timer: ReturnType<typeof setTimeout>;
    const onFocusIn = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const active = document.activeElement;
        if (active && panel.contains(active) && "scrollIntoView" in active) {
          (active as HTMLElement).scrollIntoView({ block: "nearest" });
        }
      }, 50);
    };
    panel.addEventListener("focusin", onFocusIn);
    return () => {
      clearTimeout(timer);
      panel.removeEventListener("focusin", onFocusIn);
    };
  }, [visible]);

  // Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  // Backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!visible || !mounted) return null;

  const titleId = "modal-title";

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] modal-backdrop${animating ? " is-open" : ""}`}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal-panel${animating ? " is-open" : ""}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="pressable flex h-[44px] w-[44px] items-center justify-center rounded-lg text-muted transition-colors duration-[var(--duration-fast)] hover:text-foreground"
            aria-label="Cerrar"
          >
            <svg
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18 6L6 18M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-6 pt-2">{children}</div>
      </div>
    </div>,
    document.body
  );
}
