import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ModelOptions } from "@/types/provider";
import { getDefaultModel } from "@/lib/providers/registry";

interface ModelState {
  activeModelId: string;
  modelSettings: Record<string, ModelOptions>;

  setActiveModel: (id: string) => void;
  updateModelSettings: (
    modelId: string,
    settings: Partial<ModelOptions>,
  ) => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      activeModelId: getDefaultModel(),
      modelSettings: {},

      setActiveModel: (id: string) => {
        set({ activeModelId: id });
      },

      updateModelSettings: (
        modelId: string,
        settings: Partial<ModelOptions>,
      ) => {
        set((s) => ({
          modelSettings: {
            ...s.modelSettings,
            [modelId]: { ...s.modelSettings[modelId], ...settings },
          },
        }));
      },
    }),
    {
      name: "twt-model",
      partialize: (state) => ({ activeModelId: state.activeModelId }),
      merge: (persisted, current) => ({
        ...current,
        activeModelId:
          (persisted as { activeModelId?: string })?.activeModelId ??
          current.activeModelId,
      }),
    },
  ),
);
