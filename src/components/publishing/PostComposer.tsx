'use client'

import { useState } from 'react'
import { usePublishing } from '@/hooks/usePublishing'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Clock, Save } from 'lucide-react'

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  youtube: 5000,
  whatsapp: 4096,
}

export function PostComposer() {
  const {
    content,
    selectedPlatforms,
    mediaFiles,
    scheduledAt,
    setContent,
    addPlatform,
    removePlatform,
    setMediaFiles,
    setScheduledAt,
    reset,
    canPublish,
    characterCount,
  } = usePublishing()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const currentLimit = selectedPlatforms.length > 0
    ? Math.min(...selectedPlatforms.map((p) => PLATFORM_LIMITS[p] || 63206))
    : 63206
  
  const handlePublish = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          media_urls: mediaFiles.map((f) => URL.createObjectURL(f)),
          platforms: selectedPlatforms,
          status: 'draft',
        }),
      })
      
      if (response.ok) {
        reset()
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleSchedule = async () => {
    if (!scheduledAt) return
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          media_urls: mediaFiles.map((f) => URL.createObjectURL(f)),
          platforms: selectedPlatforms,
          status: 'draft',
          scheduled_at: scheduledAt.toISOString(),
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        await fetch(`/api/posts/${data.post.id}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduled_at: scheduledAt.toISOString() }),
        })
        reset()
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleSaveDraft = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          media_urls: mediaFiles.map((f) => URL.createObjectURL(f)),
          platforms: selectedPlatforms,
          status: 'draft',
        }),
      })
      
      if (response.ok) {
        reset()
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setMediaFiles([...mediaFiles, ...files])
  }
  
  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      removePlatform(platform)
    } else {
      addPlatform(platform)
    }
  }
  
  return (
    <div className="space-y-4">
      <Textarea
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[150px] text-lg"
      />
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {characterCount} / {currentLimit}
          {characterCount > currentLimit && ' (exceeds limit)'}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {Object.keys(PLATFORM_LIMITS).map((platform) => (
          <button
            key={platform}
            type="button"
            onClick={() => togglePlatform(platform)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedPlatforms.includes(platform)
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {platform.charAt(0).toUpperCase() + platform.slice(1)}
          </button>
        ))}
      </div>
      
      <div className="border-2 border-dashed rounded-lg p-6">
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center cursor-pointer"
        >
          <span className="text-sm text-muted-foreground">
            Click to upload images or videos
          </span>
        </label>
        {mediaFiles.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {mediaFiles.map((file, index) => (
              <div key={index} className="relative">
                <span className="text-xs bg-secondary px-2 py-1 rounded">
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={scheduledAt ? scheduledAt.toISOString().slice(0, 16) : ''}
          onChange={(e) => setScheduledAt(e.target.value ? new Date(e.target.value) : null)}
          className="flex-1 px-3 py-2 border rounded-md"
        />
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={handlePublish}
          disabled={!canPublish || isSubmitting}
          className="flex-1"
        >
          <Send className="w-4 h-4 mr-2" />
          Publish Now
        </Button>
        
        <Button
          onClick={handleSchedule}
          disabled={!canPublish || !scheduledAt || isSubmitting}
          variant="outline"
          className="flex-1"
        >
          <Clock className="w-4 h-4 mr-2" />
          Schedule
        </Button>
        
        <Button
          onClick={handleSaveDraft}
          disabled={!content || isSubmitting}
          variant="secondary"
          className="flex-1"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Draft
        </Button>
      </div>
    </div>
  )
}
