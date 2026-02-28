'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import OfflineBanner from './OfflineBanner';

interface OfflineContextValue {
  isOnline: boolean;
  showOfflineBanner: boolean;
  showBackOnlineBanner: boolean;
  dismissOfflineBanner: () => void;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  showOfflineBanner: false,
  showBackOnlineBanner: false,
  dismissOfflineBanner: () => {},
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

interface OfflineProviderProps {
  children: ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  // Default to true on server (no navigator); client will correct on mount
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [showBackOnlineBanner, setShowBackOnlineBanner] = useState(false);
  // Tracks whether the user has dismissed the banner in the current offline session
  const [isDismissed, setIsDismissed] = useState(false);
  const backOnlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setShowOfflineBanner(false);
    setIsDismissed(false);

    // Show "back online" banner briefly
    setShowBackOnlineBanner(true);
    if (backOnlineTimerRef.current) clearTimeout(backOnlineTimerRef.current);
    backOnlineTimerRef.current = setTimeout(() => {
      setShowBackOnlineBanner(false);
    }, 3000);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setShowBackOnlineBanner(false);
    setIsDismissed(false); // Always show banner when going offline
    setShowOfflineBanner(true);
    if (backOnlineTimerRef.current) {
      clearTimeout(backOnlineTimerRef.current);
      backOnlineTimerRef.current = null;
    }
  }, []);

  const dismissOfflineBanner = useCallback(() => {
    setIsDismissed(true);
    setShowOfflineBanner(false);
  }, []);

  useEffect(() => {
    // Sync with actual browser status on mount
    const online = navigator.onLine;
    setIsOnline(online);
    if (!online) {
      setShowOfflineBanner(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (backOnlineTimerRef.current) clearTimeout(backOnlineTimerRef.current);
    };
  }, [handleOnline, handleOffline]);

  // When dismissed status changes alongside isOnline, update banner visibility
  useEffect(() => {
    if (!isOnline && !isDismissed) {
      setShowOfflineBanner(true);
    }
  }, [isOnline, isDismissed]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        showOfflineBanner,
        showBackOnlineBanner,
        dismissOfflineBanner,
      }}
    >
      <OfflineBanner />
      {children}
    </OfflineContext.Provider>
  );
}
