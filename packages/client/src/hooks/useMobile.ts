/**
 * useMobile - Mobile detection hook with responsive utilities
 *
 * Provides:
 * - useMediaQuery: Raw media query matching hook
 * - useMobile: Convenience hook for mobile/tablet/touch detection
 */
import { useState, useEffect } from 'react';

/**
 * Hook for responsive breakpoint detection
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns boolean - whether the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    // Set initial value
    setMatches(mediaQuery.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Mobile detection hook
 * @returns Object with device type flags
 */
export function useMobile() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const isTouchDevice = useMediaQuery('(pointer: coarse)');

  return {
    /** Screen width <= 768px */
    isMobile,
    /** Screen width <= 1024px (includes mobile) */
    isTablet,
    /** Device has coarse pointer (touch) */
    isTouchDevice,
    /** Not mobile and not tablet */
    isDesktop: !isMobile && !isTablet,
  };
}
