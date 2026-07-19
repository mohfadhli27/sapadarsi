"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ChatWorkspaceContextValue = {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  triggerNewConsultation: () => void;
  setNewConsultationHandler: (handler: (() => void) | null) => void;
};

const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(null);

export function ChatWorkspaceProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const newConsultationHandlerRef = useRef<(() => void) | null>(null);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const setNewConsultationHandler = useCallback((handler: (() => void) | null) => {
    newConsultationHandlerRef.current = handler;
  }, []);

  const triggerNewConsultation = useCallback(() => {
    newConsultationHandlerRef.current?.();
    setSidebarOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      sidebarOpen,
      openSidebar,
      closeSidebar,
      toggleSidebar,
      triggerNewConsultation,
      setNewConsultationHandler,
    }),
    [
      sidebarOpen,
      openSidebar,
      closeSidebar,
      toggleSidebar,
      triggerNewConsultation,
      setNewConsultationHandler,
    ]
  );

  return (
    <ChatWorkspaceContext.Provider value={value}>
      {children}
    </ChatWorkspaceContext.Provider>
  );
}

export function useChatWorkspace() {
  const ctx = useContext(ChatWorkspaceContext);
  if (!ctx) {
    throw new Error("useChatWorkspace must be used within ChatWorkspaceProvider");
  }
  return ctx;
}
