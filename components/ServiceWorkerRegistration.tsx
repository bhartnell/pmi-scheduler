'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker in production.
 * Rendered inside the root layout so it runs on every page.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only register in production and when the browser supports service workers
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('[SW] Registered successfully. Scope:', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new service worker is available; the page will use it on next load
              console.log('[SW] New service worker installed. Refresh to update.');
            }
          });
        });
      } catch (error) {
        console.error('[SW] Registration failed:', error);
      }
    };

    // Defer registration until after page load to avoid competing with critical resources
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
