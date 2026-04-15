import { create } from 'zustand'

export interface PublishingState {
  content: string
  selectedPlatforms: string[]
  mediaFiles: File[]
  scheduledAt: Date | null
  festivalContext: string | null
  language: string
  tone: string
  
  setContent: (content: string) => void
  setSelectedPlatforms: (platforms: string[]) => void
  addPlatform: (platform: string) => void
  removePlatform: (platform: string) => void
  setMediaFiles: (files: File[]) => void
  addMediaFile: (file: File) => void
  removeMediaFile: (index: number) => void
  setScheduledAt: (date: Date | null) => void
  setFestivalContext: (context: string | null) => void
  setLanguage: (language: string) => void
  setTone: (tone: string) => void
  reset: () => void
}

export const usePublishingStore = create<PublishingState>((set) => ({
  content: '',
  selectedPlatforms: [],
  mediaFiles: [],
  scheduledAt: null,
  festivalContext: null,
  language: 'en',
  tone: 'professional',
  
  setContent: (content) => set({ content }),
  
  setSelectedPlatforms: (platforms) => set({ selectedPlatforms: platforms }),
  
  addPlatform: (platform) => set((state) => ({
    selectedPlatforms: [...state.selectedPlatforms, platform],
  })),
  
  removePlatform: (platform) => set((state) => ({
    selectedPlatforms: state.selectedPlatforms.filter((p) => p !== platform),
  })),
  
  setMediaFiles: (files) => set({ mediaFiles: files }),
  
  addMediaFile: (file) => set((state) => ({
    mediaFiles: [...state.mediaFiles, file],
  })),
  
  removeMediaFile: (index) => set((state) => ({
    mediaFiles: state.mediaFiles.filter((_, i) => i !== index),
  })),
  
  setScheduledAt: (date) => set({ scheduledAt: date }),
  
  setFestivalContext: (context) => set({ festivalContext: context }),
  
  setLanguage: (language) => set({ language }),
  
  setTone: (tone) => set({ tone }),
  
  reset: () => set({
    content: '',
    selectedPlatforms: [],
    mediaFiles: [],
    scheduledAt: null,
    festivalContext: null,
    language: 'en',
    tone: 'professional',
  }),
}))
