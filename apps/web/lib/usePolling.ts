"use client";
import { useEffect } from "react";

// Polls `fn` every `intervalMs`, but only while the tab is visible.
// A forgotten background tab otherwise keeps the database awake around the
// clock, which is billed as compute hours.
export function usePolling(fn: () => void, intervalMs: number) {
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => { if (!id) id = setInterval(fn, intervalMs); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };

    const onVisibilityChange = () => {
      if (document.hidden) { stop(); return; }
      fn();
      start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [fn, intervalMs]);
}
