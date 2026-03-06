import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-amber-50">
      <main className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-6xl font-serif font-bold text-stone-800">
            Poopin&apos; Papers
          </h1>
          <p className="mt-4 text-xl font-serif italic text-stone-600">
            The Only Newspaper Worth Sitting Down For
          </p>
        </div>

        {/* Description Card */}
        <div className="mx-auto mb-12 max-w-2xl rounded-lg border-2 border-stone-300 bg-white p-8 text-center shadow-sm">
          <p className="text-lg leading-relaxed text-stone-700">
            A weekly family newspaper that brings your household together.
            Plan meals, assign chores, and enjoy fun activities — all in one
            printable page your kids will actually want to read.
          </p>
        </div>

        {/* CTA Button */}
        <div className="mb-16 text-center">
          <Link
            href="/signup"
            className="inline-block rounded-full bg-amber-600 px-8 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-amber-700"
          >
            Start Your First Issue
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-center shadow-sm">
            <div className="mb-3 text-4xl">🍽️</div>
            <h3 className="mb-2 text-lg font-semibold text-stone-800">Meal Plans</h3>
            <p className="text-sm text-stone-600">
              Plan breakfast, lunch, and dinner for the whole week in one place.
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-center shadow-sm">
            <div className="mb-3 text-4xl">🧹</div>
            <h3 className="mb-2 text-lg font-semibold text-stone-800">Chores</h3>
            <p className="text-sm text-stone-600">
              Assign age-appropriate tasks and keep everyone accountable.
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-center shadow-sm">
            <div className="mb-3 text-4xl">🧠</div>
            <h3 className="mb-2 text-lg font-semibold text-stone-800">Coaching</h3>
            <p className="text-sm text-stone-600">
              AI-generated tips, brain teasers, and fun content tailored to your family.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-stone-300 pt-8 text-center">
          <p className="font-serif text-stone-500">
            Poopin&apos; Papers &middot; Est. 2026
          </p>
        </footer>
      </main>
    </div>
  )
}
