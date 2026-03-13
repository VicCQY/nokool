export default function AboutPage() {
  return (
    <div className="-mt-[1px]">
      {/* Hero Section */}
      <section className="bg-[#0D0D0D] text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
            No<span className="text-[#FF5500]">Kool</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-400">
            Because someone has to keep the receipts.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] mb-6">
            Why NoKool?
          </h2>
          <div className="space-y-4 text-[#4A4A4A] leading-relaxed">
            <p>
              Politicians make promises. Lots of them. On debate stages, in rallies,
              on social media, in press conferences. Then they get elected and the
              promises get quietly shelved, watered down, or forgotten entirely.
            </p>
            <p>
              NoKool exists to track the gap between what they say and what they do.
              We pull real voting records from Congress, real campaign finance data
              from the FEC, and real executive actions from the Federal Register
              &mdash; then put it all in one place so you can see the full picture.
            </p>
            <p className="font-semibold text-[#1A1A1A]">
              We don&apos;t pick sides. We pick facts.
            </p>
          </div>
        </div>
      </section>

      {/* Grading Methodology Section */}
      <section className="bg-[#F5F5F5]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] mb-10 text-center">
            How the Grading Works
          </h2>
          <p className="text-center text-[#4A4A4A] mb-10 max-w-2xl mx-auto">
            NoKool doesn&apos;t use a simple pass/fail system. Our grade factors in
            three things:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D0D0D] text-sm font-bold text-white">
                  1-5
                </span>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  Promise Severity
                </h3>
              </div>
              <p className="text-sm text-[#4A4A4A] leading-relaxed">
                Not all promises are created equal. Pledging to &ldquo;end a
                war&rdquo; is fundamentally different from pledging to &ldquo;make
                generators tax-deductible.&rdquo; We rate each promise from 1
                (trivial) to 5 (cornerstone &mdash; a defining campaign pledge).
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D0D0D] text-sm font-bold text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </span>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  Issue Weight
                </h3>
              </div>
              <p className="text-sm text-[#4A4A4A] leading-relaxed">
                Based on voter priority data from Pew Research Center, promises in
                categories that voters care about most (like the economy) carry more
                weight than niche issues. This reflects what actually matters to the
                electorate.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0D0D0D] text-sm font-bold text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  Time Decay
                </h3>
              </div>
              <p className="text-sm text-[#4A4A4A] leading-relaxed">
                We don&apos;t punish a politician for not completing everything on
                Day 1. Early in a term, unfinished promises are expected. But as the
                clock runs out, those same unfinished promises increasingly hurt the
                grade. Break a promise? That&apos;s a full penalty regardless of
                timing.
              </p>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-[#4A4A4A] bg-white rounded-lg border border-gray-200 px-6 py-4 max-w-2xl mx-auto">
            <span className="font-semibold text-[#1A1A1A]">The formula:</span>{" "}
            Severity &times; Issue Weight &times; Status Value, normalized to a
            0&ndash;100 scale.
          </p>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] mb-10 text-center">
            Where the Data Comes From
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-xl border border-gray-200 bg-[#F5F5F5] p-5">
              <h3 className="text-sm font-bold text-[#1A1A1A] mb-2">
                Voting Records
              </h3>
              <p className="text-xs text-[#4A4A4A] leading-relaxed">
                <span className="font-medium">clerk.house.gov</span> (House) and{" "}
                <span className="font-medium">senate.gov</span> (Senate) &mdash;
                official Congressional roll call data.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-[#F5F5F5] p-5">
              <h3 className="text-sm font-bold text-[#1A1A1A] mb-2">
                Campaign Finance
              </h3>
              <p className="text-xs text-[#4A4A4A] leading-relaxed">
                <span className="font-medium">FEC.gov</span> (Federal Election
                Commission) &mdash; real donation and committee filings.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-[#F5F5F5] p-5">
              <h3 className="text-sm font-bold text-[#1A1A1A] mb-2">
                Executive Actions
              </h3>
              <p className="text-xs text-[#4A4A4A] leading-relaxed">
                <span className="font-medium">Federal Register</span> &mdash;
                executive orders, memorandums, proclamations.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-[#F5F5F5] p-5">
              <h3 className="text-sm font-bold text-[#1A1A1A] mb-2">
                Promises
              </h3>
              <p className="text-xs text-[#4A4A4A] leading-relaxed">
                Manually researched and editorially verified. Every promise
                includes a source.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who Section */}
      <section className="bg-[#F5F5F5]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] mb-6">
            Who&apos;s Behind This
          </h2>
          <p className="text-[#4A4A4A] leading-relaxed">
            NoKool is a solo project built by a political science student who got
            tired of politicians saying one thing and doing another. This isn&apos;t
            funded by any party, PAC, or interest group. It&apos;s funded by
            stubbornness and caffeine.
          </p>
        </div>
      </section>

      {/* AnTinfoil Section */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] mb-6">
            AnTinfoil
          </h2>
          <p className="text-[#4A4A4A] leading-relaxed mb-6">
            NoKool is the sibling project of AnTinfoil &mdash; a blog dedicated to
            busting political myths and misconceptions with facts, not theories.
            Different lens, same mission: truth over BS.
          </p>
          <a
            href="https://www.antinfoil.blog"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#0D0D0D] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
          >
            Visit AnTinfoil
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>

      {/* Contact Section */}
      <section className="bg-[#0D0D0D] text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            Get in Touch
          </h2>
          <p className="text-gray-400 leading-relaxed mb-6">
            Have something to report? A promise we missed? A correction? Reach out.
          </p>
          <a
            href="mailto:trackpolitician@gmail.com"
            className="inline-flex items-center gap-2 text-lg font-medium text-white hover:text-[#FF5500] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            trackpolitician@gmail.com
          </a>
        </div>
      </section>
    </div>
  );
}
