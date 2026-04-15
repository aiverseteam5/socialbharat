import { PostComposer } from '@/components/publishing/PostComposer'
import { PlatformPreview } from '@/components/publishing/PlatformPreview'
import { FestivalSuggestions } from '@/components/publishing/FestivalSuggestions'
import { AIContentAssist } from '@/components/publishing/AIContentAssist'

export default function ComposePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Compose Post</h1>
      <p className="text-muted-foreground">
        Create and publish content to your social media accounts.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FestivalSuggestions />
          <PostComposer />
        </div>
        
        <div className="space-y-6">
          <AIContentAssist />
          <PlatformPreview />
        </div>
      </div>
    </div>
  )
}
