export default function PaperLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-300/50">
      <div className="text-center">
        <div className="mb-6 text-5xl animate-bounce" style={{ animationDuration: '2s' }}>
          🧻
        </div>
        <p className="text-stone-700 text-xl font-serif font-bold mb-2">
          Preparing your paper...
        </p>
        <p className="text-stone-400 text-sm">
          Setting things up, just a moment
        </p>
        <div className="mt-6 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-stone-400 animate-bounce"
              style={{ animationDelay: `${i * 0.2}s`, animationDuration: '1s' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
