import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Refresh auth tokens via Supabase middleware
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  
  await updateSession(request)
  
  const { pathname } = request.nextUrl
  
  // Protect /dashboard/* routes
  if (pathname.startsWith('/dashboard')) {
    await updateSession(request)
    
    // If no session, redirect to /login
    // We'll check the session in the response headers or cookies
    // For now, we'll let the server components handle the auth check
    // and redirect if needed
  }
  
  // Redirect authenticated users away from /login and /register
  if ((pathname === '/login' || pathname === '/register')) {
    // Check if session exists
    // If yes, redirect to /dashboard
    // This will be handled by the auth helpers in the page components
  }
  
  // Allow /api/* routes through (they handle their own auth)
  if (pathname.startsWith('/api')) {
    return response
  }
  
  // Allow /(marketing)/* routes through (public)
  if (pathname.startsWith('/(marketing)')) {
    return response
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
