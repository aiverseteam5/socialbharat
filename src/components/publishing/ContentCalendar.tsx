'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarPost {
  id: string
  content: string
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  scheduled_at: string | null
}

export function ContentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week'>('month')
  const [posts, setPosts] = useState<CalendarPost[]>([])
  
  const fetchPosts = useCallback(async () => {
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    
    const response = await fetch(
      `/api/posts/calendar?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`
    )
    const data = await response.json()
    setPosts(data.posts || [])
  }, [currentDate])
  
  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-400'
      case 'scheduled': return 'bg-blue-500'
      case 'published': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }
  
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }
  
  const renderCalendar = () => {
    const days = []
    
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border border-gray-200 bg-gray-50" />)
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayPosts = posts.filter((p) => p.scheduled_at?.startsWith(dateStr))
      
      days.push(
        <div key={day} className="p-2 border border-gray-200 min-h-[100px]">
          <span className="text-sm font-medium">{day}</span>
          <div className="mt-1 space-y-1">
            {dayPosts.slice(0, 3).map((post) => (
              <div
                key={post.id}
                className={`text-xs p-1 rounded text-white truncate ${getStatusColor(post.status)}`}
              >
                {post.content.substring(0, 20)}...
              </div>
            ))}
            {dayPosts.length > 3 && (
              <span className="text-xs text-muted-foreground">+{dayPosts.length - 3} more</span>
            )}
          </div>
        </div>
      )
    }
    
    return days
  }
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex gap-2 mb-4">
        <Button
          variant={view === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('month')}
        >
          Month
        </Button>
        <Button
          variant={view === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('week')}
        >
          Week
        </Button>
      </div>
      
      <div className="grid grid-cols-7 gap-0 border border-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 border border-gray-200 bg-gray-100 font-medium text-sm text-center">
            {day}
          </div>
        ))}
        {renderCalendar()}
      </div>
      
      <div className="flex gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded" />
          <span>Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span>Published</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span>Failed</span>
        </div>
      </div>
    </Card>
  )
}
