import { usePublishingStore } from '@/stores/publishing-store'

export function usePublishing() {
  const store = usePublishingStore()
  
  return {
    ...store,
    characterCount: store.content.length,
    hasContent: store.content.length > 0,
    hasPlatforms: store.selectedPlatforms.length > 0,
    hasMedia: store.mediaFiles.length > 0,
    isScheduled: store.scheduledAt !== null,
    canPublish: store.content.length > 0 && store.selectedPlatforms.length > 0,
  }
}
