import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function MarketingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">SocialBharat</h1>
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
            SocialBharat
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            India&apos;s #1 Social Media Platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </main>
      
      <footer className="border-t bg-card py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2025 SocialBharat. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
