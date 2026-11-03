'use client';

import { useCallback, useRef } from 'react';

/**
 * Publishes a fixed-bottom banner's height as the CSS variable
 * `--bottom-banner-h` on <html>, so FloatingDock can ride above the banner
 * instead of sitting on it. Attach the returned callback ref to the banner's
 * root element; the variable is reset to 0 when the banner unmounts.
 */
export function useBottomBannerOffset() {
  const observerRef = useRef<ResizeObserver | null>(null);

  return useCallback((el: HTMLElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    const root = document.documentElement;
    if (!el) {
      root.style.setProperty('--bottom-banner-h', '0px');
      document.body.style.paddingBottom = '';
      return;
    }
    // The banner takes its own space: pad the page bottom by its height so Save is never covered.
    const publish = () => {
      root.style.setProperty('--bottom-banner-h', `${el.offsetHeight}px`);
      document.body.style.paddingBottom = `${el.offsetHeight}px`;
    };
    publish();
    if (typeof ResizeObserver !== 'undefined') {
      observerRef.current = new ResizeObserver(publish);
      observerRef.current.observe(el);
    }
  }, []);
}
