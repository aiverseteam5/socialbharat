'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { usePublishing } from '@/hooks/usePublishing'

export function FestivalSuggestions() {
  const [festivals, setFestivals] = useState<unknown[]>([])
  const { setFestivalContext, setContent } = usePublishing()
  
  useEffect(() => {
    loadFestivals()
  }, [])
  
  const loadFestivals = async () => {
    try {
      const response = await fetch('/api/festivals?days=14')
      const data = await response.json()
      setFestivals(data.festivals || [])
    } catch (error) {
      console.error('Error loading festivals:', error)
    }
  }
  
  const handleGenerateContent = (festival: unknown) => {
    const festivalData = festival as { name: string; name_hindi: string | null; hashtags: string[] }
    setFestivalContext(festivalData.name)
    setContent(`🎉 ${festivalData.name}${festivalData.name_hindi ? ` (${festivalData.name_hindi})` : ''} is coming up! ${festivalData.hashtags.join(' ')}`)
  }
  
  if (festivals.length === 0) {
    return null
  }
  
  return (
    <Card className="p-4 bg-gradient-to-r from-orange-100 to-yellow-100 border-orange-300">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-orange-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-orange-900">Upcoming Festival</h3>
          {festivals.slice(0, 1).map((festival, index) => {
            const f = festival as { name: string; name_hindi: string | null; date: string; hashtags: string[] }
            return (
              <div key={index} className="mt-2">
                <p className="text-sm text-orange-800">
                  <span className="font-medium">{f.name}</span>
                  {f.name_hindi && <span className="ml-2">({f.name_hindi})</span>}
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  {new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.hashtags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="text-xs bg-orange-200 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => handleGenerateContent(festival)}
                >
                  Generate Content
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
