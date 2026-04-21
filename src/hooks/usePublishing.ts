import { usePublishingStore } from "@/stores/publishing-store";

export function usePublishing() {
  const store = usePublishingStore();

  const hasUploadingMedia = store.mediaUploads.some(
    (m) => m.status === "uploading",
  );
  const allMediaUploaded = store.mediaUploads.every(
    (m) => m.status === "uploaded",
  );
  const uploadedMediaUrls = store.mediaUploads
    .filter((m) => m.status === "uploaded" && m.url)
    .map((m) => m.url as string);

  return {
    ...store,
    characterCount: store.content.length,
    hasContent: store.content.length > 0,
    hasPlatforms: store.selectedPlatforms.length > 0,
    hasMedia: store.mediaUploads.length > 0,
    hasUploadingMedia,
    allMediaUploaded,
    uploadedMediaUrls,
    isScheduled: store.scheduledAt !== null,
    canPublish:
      store.content.length > 0 &&
      store.selectedPlatforms.length > 0 &&
      !hasUploadingMedia &&
      allMediaUploaded,
  };
}
