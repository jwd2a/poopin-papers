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
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname)
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

  // Check subscription status for authenticated users on protected routes
  if (user && !isPublicRoute && !isCronRoute && !isWebhookRoute && !isSubscribeRoute && !isCheckoutRoute && !isSignoutRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_name, subscription_status, is_admin')
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

    // Not subscribed — redirect to /subscribe
    if (profile?.subscription_status !== 'active') {
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
