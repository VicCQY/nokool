export default function Loading() {
  return (
    <div>
      {/* Hero skeleton */}
      <section className="bg-[#0D0D0D] -mt-[1px]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row items-start gap-6 animate-pulse">
            <div className="h-20 w-20 sm:h-28 sm:w-28 rounded-full bg-gray-700" />
            <div className="flex-1 space-y-3">
              <div className="h-8 w-64 rounded bg-gray-700" />
              <div className="h-4 w-40 rounded bg-gray-800" />
              <div className="h-3 w-48 rounded bg-gray-800" />
            </div>
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-2">
                <div className="h-20 w-20 rounded-full bg-gray-700" />
                <div className="h-4 w-12 rounded bg-gray-700" />
              </div>
              <div className="h-24 w-16 rounded-lg bg-gray-700" />
            </div>
          </div>
          <div className="mt-8 max-w-md">
            <div className="h-1.5 w-full rounded-full bg-white/10" />
          </div>
        </div>
      </section>

      {/* Content skeleton */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-gray-200" />
          ))}
        </div>
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="h-5 w-3/4 rounded bg-gray-200 mb-3" />
              <div className="h-4 w-1/2 rounded bg-gray-100 mb-2" />
              <div className="h-3 w-full rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
