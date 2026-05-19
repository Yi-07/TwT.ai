import { create } from "zustand";
import type { ModelOptions } from "@/types/provider";

interface ModelState {
  activeModelId: string;
  modelSettings: Record<string, ModelOptions>;

  setActiveModel: (id: string) => void;
  updateModelSettings: (modelId: string, settings: Partial<ModelOptions>) => void;
}

export const useModelStore = create<ModelState>()((set) => ({
  activeModelId: "claude",
  modelSettings: {},

  setActiveModel: (id: string) => {
    set({ activeModelId: id });
  },

  updateModelSettings: (modelId: string, settings: Partial<ModelOptions>) => {
    set((s) => ({
      modelSettings: {
        ...s.modelSettings,
        [modelId]: { ...s.modelSettings[modelId], ...settings },
      },
    }));
  },
}));
