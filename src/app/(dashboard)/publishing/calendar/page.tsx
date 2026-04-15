import { ContentCalendar } from '@/components/publishing/ContentCalendar'

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Content Calendar</h1>
      <p className="text-muted-foreground">
        View and manage your scheduled content.
      </p>
      
      <ContentCalendar />
    </div>
  )
}
