'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

interface EditModeContextValue {
  isEditing: boolean;
  toggleEditMode: () => void;
  exitEditMode: () => void;
  previewViewport: PreviewViewport;
  setPreviewViewport: (v: PreviewViewport) => void;
}

const EditModeContext = createContext<EditModeContextValue>({
  isEditing: false,
  toggleEditMode: () => {},
  exitEditMode: () => {},
  previewViewport: 'desktop',
  setPreviewViewport: () => {},
});

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>(() => {
    if (typeof window === 'undefined') return 'desktop';
    if (window.innerWidth >= 1024) return 'desktop';
    if (window.innerWidth >= 768) return 'tablet';
    return 'mobile';
  });

  const screenViewport = (): PreviewViewport => {
    if (typeof window === 'undefined') return 'desktop';
    if (window.innerWidth >= 1024) return 'desktop';
    if (window.innerWidth >= 768) return 'tablet';
    return 'mobile';
  };

  const toggleEditMode = () => setIsEditing(v => !v);
  const exitEditMode = () => {
    setIsEditing(false);
    setPreviewViewport(screenViewport());
  };

  return (
    <EditModeContext.Provider value={{ isEditing, toggleEditMode, exitEditMode, previewViewport, setPreviewViewport }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  return useContext(EditModeContext);
}
