"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <section className="bg-[#0D0D0D] -mt-[1px]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="font-mono text-6xl font-bold text-red-500">!</p>
          <h1 className="mt-4 text-3xl font-headline text-white">
            Something went wrong
          </h1>
          <p className="mt-3 text-gray-400">
            An unexpected error occurred. Please try again.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 text-center">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Again
        </button>
      </section>
    </div>
  );
}
