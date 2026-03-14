import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <section className="bg-[#0D0D0D] -mt-[1px]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <p className="font-mono text-6xl font-bold text-gray-500">404</p>
          <h1 className="mt-4 text-3xl font-headline text-white">
            Page not found
          </h1>
          <p className="mt-3 text-gray-400">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </section>
    </div>
  );
}
