'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Edit, Trash2 } from 'lucide-react'

interface DraftPost {
  id: string
  content: string
  created_at: string
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftPost[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchDrafts()
  }, [])
  
  const fetchDrafts = async () => {
    try {
      const response = await fetch('/api/posts?status=draft')
      const data = await response.json()
      setDrafts(data.posts || [])
    } catch (error) {
      console.error('Error fetching drafts:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return
    
    try {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' })
      setDrafts(drafts.filter((d) => d.id !== id))
    } catch (error) {
      console.error('Error deleting draft:', error)
    }
  }
  
  if (loading) {
    return <div className="text-center py-8">Loading drafts...</div>
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Drafts</h1>
      <p className="text-muted-foreground">
        Manage your unpublished posts.
      </p>
      
      {drafts.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No drafts yet</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <Card key={draft.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm">{draft.content.substring(0, 200)}...</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {new Date(draft.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(draft.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
