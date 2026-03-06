import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types/database'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let familyName = ''
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_name')
      .eq('id', user.id)
      .single()
    familyName = (profile as Pick<Profile, 'family_name'> | null)?.family_name ?? ''
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-stone-800">
              Poopin&apos; Papers
            </h1>
            {familyName && (
              <p className="text-sm text-stone-500">
                The {familyName} Edition
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="text-sm text-stone-600 hover:text-stone-800"
            >
              Settings
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm text-stone-500 hover:text-stone-700"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
