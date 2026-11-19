import { useEffect, useState } from "react"
import { SMALL_SCREEN_BREAKPOINT } from "@/lib/viewport"

/**
 * True when the small-screen (single-pane) layout should be used.
 * The breakpoint lives in `@/lib/viewport` so the AI system prompt and the
 * console tools see exactly the same threshold as the UI.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(window.innerWidth < SMALL_SCREEN_BREAKPOINT);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SMALL_SCREEN_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < SMALL_SCREEN_BREAKPOINT);
    }
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < SMALL_SCREEN_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
