import { useState, useEffect } from 'react';

/**
 * Custom hook to track whether a given media query matches the viewport.
 * Uses window.matchMedia with change event listener and SSR safety.
 */
export function useMediaQuery(query: string = '(max-width: 768px)'): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQueryList.matches);

    // Modern browsers
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', listener);
      return () => mediaQueryList.removeEventListener('change', listener);
    } else {
      // Legacy fallback
      mediaQueryList.addListener(listener);
      return () => mediaQueryList.removeListener(listener);
    }
  }, [query]);

  return matches;
}

/**
 * Convenience hook specifically for mobile screen detection (<= 768px).
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)');
}
