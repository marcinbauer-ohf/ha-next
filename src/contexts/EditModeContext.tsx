'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface EditModeContextValue {
  isEditing: boolean;
  toggleEditMode: () => void;
  exitEditMode: () => void;
}

const EditModeContext = createContext<EditModeContextValue>({
  isEditing: false,
  toggleEditMode: () => {},
  exitEditMode: () => {},
});

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditing, setIsEditing] = useState(false);

  const toggleEditMode = () => setIsEditing(v => !v);
  const exitEditMode = () => setIsEditing(false);

  return (
    <EditModeContext.Provider value={{ isEditing, toggleEditMode, exitEditMode }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  return useContext(EditModeContext);
}
