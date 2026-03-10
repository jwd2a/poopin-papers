import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PaperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex h-screen flex-col bg-stone-100">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
        <h1 className="font-[var(--font-playfair)] text-xl font-bold text-stone-800">
          Poopin&apos; Papers
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Advanced Editor
          </Link>
          <Link
            href="/dashboard/settings"
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Settings
          </Link>
          <form action="/api/auth/signout" method="post">
            <button className="text-sm text-stone-500 hover:text-stone-700">
              Sign Out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
