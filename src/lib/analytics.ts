import posthog from 'posthog-js'

let isInitialized = false

export function initAnalytics() {
  if (typeof window === 'undefined') return
  
  if (isInitialized) return
  
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  
  posthog.init(key, {
    api_host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    capture_pageview: false,
  })
  
  isInitialized = true
}

export function track(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  
  if (!isInitialized) {
    initAnalytics()
  }
  
  posthog.capture(eventName, properties)
}

export function pageView() {
  if (typeof window === 'undefined') return
  
  if (!isInitialized) {
    initAnalytics()
  }
  
  posthog.capture('$pageview')
}
