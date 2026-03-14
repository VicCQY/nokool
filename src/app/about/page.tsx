export default function AboutPage() {
  return (
    <div className="-mt-[1px]">
      {/* Hero Section */}
      <section className="bg-brand-ink text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-5xl sm:text-6xl font-headline tracking-tight">
            No<span className="text-brand-red">Kool</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-400 italic">
            Because someone has to keep the receipts.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-headline text-brand-charcoal mb-6">
            Why NoKool?
          </h2>
          <div className="space-y-4 text-slate leading-relaxed">
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
            <p className="font-semibold text-brand-charcoal">
              We don&apos;t pick sides. We pick facts.
            </p>
          </div>
        </div>
      </section>

      {/* Grading Methodology Section */}
      <section className="bg-cool-gray">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-headline text-brand-charcoal mb-10 text-center">
            How the Grading Works
          </h2>
          <p className="text-center text-slate mb-10 max-w-2xl mx-auto">
            NoKool doesn&apos;t use a simple pass/fail system. Our grade factors in
            three things:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-lg border border-gray-200 border-l-4 border-l-brand-red bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-ink text-sm font-data font-bold text-white">
                  1-5
                </span>
                <h3 className="text-base font-headline text-brand-charcoal">
                  Promise Severity
                </h3>
              </div>
              <p className="text-sm text-slate leading-relaxed">
                Not all promises are created equal. Pledging to &ldquo;end a
                war&rdquo; is fundamentally different from pledging to &ldquo;make
                generators tax-deductible.&rdquo; We rate each promise from 1
                (trivial) to 5 (cornerstone &mdash; a defining campaign pledge).
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-lg border border-gray-200 border-l-4 border-l-[#2563EB] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-ink text-sm font-bold text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </span>
                <h3 className="text-base font-headline text-brand-charcoal">
                  Issue Weight
                </h3>
              </div>
              <p className="text-sm text-slate leading-relaxed">
                Based on voter priority data from Pew Research Center, promises in
                categories that voters care about most (like the economy) carry more
                weight than niche issues. This reflects what actually matters to the
                electorate.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-lg border border-gray-200 border-l-4 border-l-[#D97706] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-ink text-sm font-bold text-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <h3 className="text-base font-headline text-brand-charcoal">
                  Time Decay
                </h3>
              </div>
              <p className="text-sm text-slate leading-relaxed">
                We don&apos;t punish a politician for not completing everything on
                Day 1. Early in a term, unfinished promises are expected. But as the
                clock runs out, those same unfinished promises increasingly hurt the
                grade. Break a promise? That&apos;s a full penalty regardless of
                timing.
              </p>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-slate bg-white rounded-lg border border-gray-200 px-6 py-4 max-w-2xl mx-auto">
            <span className="font-semibold text-brand-charcoal">The formula:</span>{" "}
            Severity &times; Issue Weight &times; Status Value, normalized to a{" "}
            <span className="font-data">0&ndash;100</span> scale.
          </p>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-headline text-brand-charcoal mb-10 text-center">
            Where the Data Comes From
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-lg border border-gray-200 bg-cool-gray p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-5 w-5 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
                <h3 className="text-sm font-bold text-brand-charcoal">
                  Voting Records
                </h3>
              </div>
              <p className="text-xs text-slate leading-relaxed">
                <span className="font-data font-medium">clerk.house.gov</span> (House) and{" "}
                <span className="font-data font-medium">senate.gov</span> (Senate) &mdash;
                official Congressional roll call data.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-cool-gray p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-5 w-5 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-bold text-brand-charcoal">
                  Campaign Finance
                </h3>
              </div>
              <p className="text-xs text-slate leading-relaxed">
                <span className="font-data font-medium">FEC.gov</span> (Federal Election
                Commission) &mdash; real donation and committee filings.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-cool-gray p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-5 w-5 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.907 0a48.062 48.062 0 00-5.657 0m5.657 0l6.093 6.093M3.375 17.25A2.25 2.25 0 015.625 15h12.75a2.25 2.25 0 012.25 2.25v.75a2.25 2.25 0 01-2.25 2.25H5.625a2.25 2.25 0 01-2.25-2.25v-.75z" />
                </svg>
                <h3 className="text-sm font-bold text-brand-charcoal">
                  Executive Actions
                </h3>
              </div>
              <p className="text-xs text-slate leading-relaxed">
                <span className="font-data font-medium">Federal Register</span> &mdash;
                executive orders, memorandums, proclamations.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-cool-gray p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-5 w-5 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                </svg>
                <h3 className="text-sm font-bold text-brand-charcoal">
                  Promises
                </h3>
              </div>
              <p className="text-xs text-slate leading-relaxed">
                Manually researched and editorially verified. Every promise
                includes a source.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who Section */}
      <section className="bg-cream">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-headline text-brand-charcoal mb-6">
            Who&apos;s Behind This
          </h2>
          <p className="text-slate leading-relaxed">
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
          <h2 className="text-2xl sm:text-3xl font-headline text-brand-charcoal mb-6">
            AnTinfoil
          </h2>
          <p className="text-slate leading-relaxed mb-6">
            NoKool is the sibling project of AnTinfoil &mdash; a blog dedicated to
            busting political myths and misconceptions with facts, not theories.
            Different lens, same mission: truth over BS.
          </p>
          <a
            href="https://www.antinfoil.blog"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
          >
            Visit AnTinfoil
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </section>

      {/* Contact Section */}
      <section className="bg-brand-ink text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-headline mb-6">
            Get in Touch
          </h2>
          <p className="text-gray-400 leading-relaxed mb-6">
            Have something to report? A promise we missed? A correction? Reach out.
          </p>
          <a
            href="mailto:trackpolitician@gmail.com"
            className="inline-flex items-center gap-2 text-lg font-medium text-white hover:text-brand-red transition-colors"
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
