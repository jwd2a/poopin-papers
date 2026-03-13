import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicRoutes = ['/', '/login', '/signup', '/auth/callback']
  const isDevPreview = process.env.NODE_ENV === 'development' && request.nextUrl.pathname === '/email-preview'
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname) || isDevPreview
  const isCronRoute = request.nextUrl.pathname.startsWith('/api/cron/')
  const isWebhookRoute = request.nextUrl.pathname === '/api/stripe/webhook'
  const isSubscribeRoute = request.nextUrl.pathname === '/subscribe'
  const isCheckoutRoute = request.nextUrl.pathname === '/api/stripe/checkout'
  const isSignoutRoute = request.nextUrl.pathname === '/api/auth/signout'

  if (!user && !isPublicRoute && !isCronRoute && !isWebhookRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from login/signup
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/paper'
    return NextResponse.redirect(url)
  }

  // Routes that free-trial users can access without a subscription
  const freeTrialRoutes = ['/onboarding', '/paper']
  const freeTrialApiPrefixes = [
    '/api/generate-paper', '/api/compose', '/api/pdf/',
    '/api/chat', '/api/sections/', '/api/papers/sections/',
    '/api/sync-sections', '/api/welcome-email',
  ]
  const isFreeTrialRoute = freeTrialRoutes.includes(request.nextUrl.pathname) ||
    freeTrialApiPrefixes.some(prefix => request.nextUrl.pathname.startsWith(prefix))

  // Check subscription status for authenticated users on protected routes
  if (user && !isPublicRoute && !isCronRoute && !isWebhookRoute && !isSubscribeRoute && !isCheckoutRoute && !isSignoutRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_name, subscription_status, is_admin, free_issue_used')
      .eq('id', user.id)
      .single()

    // Admin bypass — skip subscription check
    if (profile?.is_admin) {
      if (request.nextUrl.pathname === '/onboarding' && profile?.family_name) {
        const url = request.nextUrl.clone()
        url.pathname = '/paper'
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }

    // Not subscribed
    if (profile?.subscription_status !== 'active') {
      // Free trial: haven't used their free issue yet — allow onboarding + paper routes
      if (!profile?.free_issue_used && isFreeTrialRoute) {
        // Allow through, but redirect onboarding to paper if already onboarded
        if (request.nextUrl.pathname === '/onboarding' && profile?.family_name) {
          const url = request.nextUrl.clone()
          url.pathname = '/paper'
          return NextResponse.redirect(url)
        }
        return supabaseResponse
      }

      // Free issue used OR accessing a non-trial route — paywall
      const url = request.nextUrl.clone()
      url.pathname = '/subscribe'
      return NextResponse.redirect(url)
    }

    // Already onboarded — skip to paper
    if (request.nextUrl.pathname === '/onboarding' && profile?.family_name) {
      const url = request.nextUrl.clone()
      url.pathname = '/paper'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
