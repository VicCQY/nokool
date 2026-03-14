import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-brand-ink border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <p className="text-xl font-headline text-white">
              No<span className="text-brand-red">Kool</span>
            </p>
            <p className="text-sm text-gray-500 mt-2 italic">
              We don&apos;t drink it, neither should you.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Navigation
            </h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Home
              </Link>
              <Link
                href="/politicians"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Politicians
              </Link>
              <Link
                href="/compare"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Compare
              </Link>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Resources
            </h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/about"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                About
              </Link>
              <a
                href="https://www.antinfoil.blog"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
              >
                AnTinfoil
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Contact
            </h4>
            <a
              href="mailto:trackpolitician@gmail.com"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              trackpolitician@gmail.com
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-gray-600">
            &copy; 2026 NoKool. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
