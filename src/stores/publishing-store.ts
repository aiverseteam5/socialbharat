import { create } from "zustand";

export type MediaUploadStatus = "uploading" | "uploaded" | "failed";

export interface MediaUpload {
  tempId: string;
  file: File;
  status: MediaUploadStatus;
  progress: number;
  url?: string;
  mediaAssetId?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface PublishingState {
  content: string;
  selectedPlatforms: string[];
  mediaUploads: MediaUpload[];
  scheduledAt: Date | null;
  festivalContext: string | null;
  language: string;
  tone: string;

  setContent: (content: string) => void;
  setSelectedPlatforms: (platforms: string[]) => void;
  addPlatform: (platform: string) => void;
  removePlatform: (platform: string) => void;
  addMediaUpload: (upload: MediaUpload) => void;
  updateMediaUpload: (tempId: string, updates: Partial<MediaUpload>) => void;
  removeMediaUpload: (tempId: string) => void;
  setScheduledAt: (date: Date | null) => void;
  setFestivalContext: (context: string | null) => void;
  setLanguage: (language: string) => void;
  setTone: (tone: string) => void;
  reset: () => void;
}

export const usePublishingStore = create<PublishingState>((set) => ({
  content: "",
  selectedPlatforms: [],
  mediaUploads: [],
  scheduledAt: null,
  festivalContext: null,
  language: "en",
  tone: "professional",

  setContent: (content) => set({ content }),

  setSelectedPlatforms: (platforms) => set({ selectedPlatforms: platforms }),

  addPlatform: (platform) =>
    set((state) => ({
      selectedPlatforms: [...state.selectedPlatforms, platform],
    })),

  removePlatform: (platform) =>
    set((state) => ({
      selectedPlatforms: state.selectedPlatforms.filter((p) => p !== platform),
    })),

  addMediaUpload: (upload) =>
    set((state) => ({
      mediaUploads: [...state.mediaUploads, upload],
    })),

  updateMediaUpload: (tempId, updates) =>
    set((state) => ({
      mediaUploads: state.mediaUploads.map((m) =>
        m.tempId === tempId ? { ...m, ...updates } : m,
      ),
    })),

  removeMediaUpload: (tempId) =>
    set((state) => ({
      mediaUploads: state.mediaUploads.filter((m) => m.tempId !== tempId),
    })),

  setScheduledAt: (date) => set({ scheduledAt: date }),

  setFestivalContext: (context) => set({ festivalContext: context }),

  setLanguage: (language) => set({ language }),

  setTone: (tone) => set({ tone }),

  reset: () =>
    set({
      content: "",
      selectedPlatforms: [],
      mediaUploads: [],
      scheduledAt: null,
      festivalContext: null,
      language: "en",
      tone: "professional",
    }),
}));
