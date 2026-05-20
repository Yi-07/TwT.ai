import { create } from "zustand";
import type { ModelOptions } from "@/types/provider";
import { getDefaultModel } from "@/lib/providers/registry";

interface ModelState {
  activeModelId: string;
  modelSettings: Record<string, ModelOptions>;

  setActiveModel: (id: string) => void;
  updateModelSettings: (modelId: string, settings: Partial<ModelOptions>) => void;
}

export const useModelStore = create<ModelState>()((set) => ({
  activeModelId: getDefaultModel(),
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
