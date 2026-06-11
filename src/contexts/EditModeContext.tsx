'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile';
export type PreviewOrientation = 'portrait' | 'landscape';

interface EditModeContextValue {
  isEditing: boolean;
  toggleEditMode: () => void;
  exitEditMode: () => void;
  previewViewport: PreviewViewport;
  setPreviewViewport: (v: PreviewViewport) => void;
  previewOrientation: PreviewOrientation;
  togglePreviewOrientation: () => void;
}

const EditModeContext = createContext<EditModeContextValue>({
  isEditing: false,
  toggleEditMode: () => {},
  exitEditMode: () => {},
  previewViewport: 'desktop',
  setPreviewViewport: () => {},
  previewOrientation: 'portrait',
  togglePreviewOrientation: () => {},
});

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);
  const [previewOrientation, setPreviewOrientation] = useState<PreviewOrientation>('portrait');
  const [previewViewport, setPreviewViewportState] = useState<PreviewViewport>(() => {
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

  // Switching to a different device always starts in portrait; a second tap
  // on the already-active device flips orientation (handled by the toolbar).
  const setPreviewViewport = (v: PreviewViewport) => {
    setPreviewViewportState(v);
    setPreviewOrientation('portrait');
  };

  const togglePreviewOrientation = () =>
    setPreviewOrientation(o => (o === 'portrait' ? 'landscape' : 'portrait'));

  const toggleEditMode = () => setIsEditing(v => !v);
  const exitEditMode = () => {
    setIsEditing(false);
    setPreviewViewportState(screenViewport());
    setPreviewOrientation('portrait');
  };

  return (
    <EditModeContext.Provider value={{ isEditing, toggleEditMode, exitEditMode, previewViewport, setPreviewViewport, previewOrientation, togglePreviewOrientation }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  return useContext(EditModeContext);
}
