'use client'

import Link from 'next/link'

export function PreviewToolbar({ paperId }: { paperId: string }) {
  return (
    <div className="print:hidden sticky top-0 z-10 bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href={`/dashboard`}
          className="text-sm text-stone-600 hover:text-stone-900 flex items-center gap-1"
        >
          &larr; Back to Editor
        </Link>

        <h1 className="text-lg font-semibold text-stone-900">Preview</h1>

        <div className="flex items-center gap-3">
          <a
            href={`/api/pdf/${paperId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md transition-colors"
          >
            Download PDF
          </a>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-sm bg-stone-900 hover:bg-stone-800 text-white rounded-md transition-colors"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  )
}
