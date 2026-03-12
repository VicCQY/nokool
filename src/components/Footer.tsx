import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#0D0D0D] border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-white">
              No<span className="text-red-500">Kool</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              We don&apos;t drink it, neither should you.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              About
            </Link>
            <a
              href="#"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-gray-600">
            NoKool &copy; 2026 &mdash; We don&apos;t drink it, neither should
            you.
          </p>
        </div>
      </div>
    </footer>
  );
}
