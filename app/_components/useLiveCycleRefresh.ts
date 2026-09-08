"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { CycleMode } from "@/lib/cycle";
import { getNextCycleBoundary } from "@/lib/cycle";

// Debounce floor — ignore visibility/focus events if we refreshed recently.
const MIN_REFRESH_INTERVAL_MS = 5_000;

// setTimeout clamps to 32-bit signed int; boundaries are <=31 days away so
// this is always safe, but clamp defensively anyway.
const MAX_TIMEOUT_MS = 2_147_000_000;

const TZ_COOKIE = "localTzOffsetMinutes";

/** Read a cookie value by name (client-side only). */
function readCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));
  return match?.split("=")[1];
}

/**
 * Write the client's timezone offset (minutes) into a cookie so the server
 * can compute cycle ranges in the user's local time.
 *
 * Returns true if the cookie was actually changed (missing or different value).
 */
function syncTzCookie(): boolean {
  const offset = new Date().getTimezoneOffset(); // JS convention: UTC-6 → +360
  const current = readCookie(TZ_COOKIE);
  const value = String(offset);
  if (current === value) return false;
  document.cookie = `${TZ_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  return true;
}

/**
 * Keeps the dashboard alive across time by calling `router.refresh()` at the
 * right moments so server components re-compute cycle data with `new Date()`.
 *
 * Two triggers:
 *  1. Tab/window becomes visible again (visibilitychange + focus fallback).
 *  2. A scheduled timer fires exactly at the next cycle boundary, then
 *     reschedules for the one after that.
 *
 * Both paths are throttled by MIN_REFRESH_INTERVAL_MS to avoid churn.
 * Timers are cleared on unmount and when `mode` changes.
 *
 * On mount and on every visibility restore, the client's timezone offset is
 * synced to a cookie. If the value changed, a router.refresh() is triggered
 * so the server re-renders with the correct local time.
 */
export function useLiveCycleRefresh(mode: CycleMode): void {
  const router = useRouter();
  const lastRefreshAt = useRef(0);
  const boundaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable throttled refresh — reads refs so it never goes stale.
  const throttledRefresh = useRef(() => {});
  throttledRefresh.current = () => {
    const now = Date.now();
    if (now - lastRefreshAt.current < MIN_REFRESH_INTERVAL_MS) return;
    lastRefreshAt.current = now;
    router.refresh();
  };

  // ── 0. Sync timezone cookie on mount ──────────────────────────────────────
  useEffect(() => {
    if (syncTzCookie()) {
      // Cookie was missing or changed → refresh so server picks up the offset.
      throttledRefresh.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 1. Visibility / focus restore ──────────────────────────────────────────
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        syncTzCookie(); // keep cookie fresh (DST transitions, travel, etc.)
        throttledRefresh.current();
      }
    };
    const onFocus = () => throttledRefresh.current();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // ── 2. Boundary timer ──────────────────────────────────────────────────────
  useEffect(() => {
    function schedule() {
      const now = new Date();
      const target = getNextCycleBoundary(mode, now);
      let delay = target.getTime() - now.getTime();
      if (!Number.isFinite(delay) || delay < 0) delay = 0;
      delay = Math.min(delay, MAX_TIMEOUT_MS);

      boundaryTimer.current = setTimeout(() => {
        throttledRefresh.current();
        schedule(); // reschedule for the following boundary
      }, delay);
    }

    schedule();

    return () => {
      if (boundaryTimer.current !== null) {
        clearTimeout(boundaryTimer.current);
        boundaryTimer.current = null;
      }
    };
  }, [mode]);
}
