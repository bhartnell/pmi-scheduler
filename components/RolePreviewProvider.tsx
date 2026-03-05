'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Role } from '@/lib/permissions';

interface RolePreviewContextType {
  previewRole: Role | null;
  isPreviewMode: boolean;
  startPreview: (role: Role) => void;
  exitPreview: () => void;
}

const RolePreviewContext = createContext<RolePreviewContextType | null>(null);

export function useRolePreview(): RolePreviewContextType {
  const context = useContext(RolePreviewContext);
  if (!context) {
    return {
      previewRole: null,
      isPreviewMode: false,
      startPreview: () => {},
      exitPreview: () => {},
    };
  }
  return context;
}

export function RolePreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewRole, setPreviewRole] = useState<Role | null>(null);

  const startPreview = useCallback((role: Role) => {
    setPreviewRole(role);
  }, []);

  const exitPreview = useCallback(() => {
    setPreviewRole(null);
  }, []);

  return (
    <RolePreviewContext.Provider value={{
      previewRole,
      isPreviewMode: previewRole !== null,
      startPreview,
      exitPreview,
    }}>
      {children}
    </RolePreviewContext.Provider>
  );
}
