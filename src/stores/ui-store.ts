"use client";

import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  isPageLoading: boolean;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setPageLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: false,
  isPageLoading: false,

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setPageLoading: (isPageLoading) => set({ isPageLoading }),
}));
