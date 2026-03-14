import type { Metadata } from "next";
import { Inter, DM_Serif_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "NoKool — We don't drink it, neither should you.",
    template: "%s | NoKool",
  },
  description:
    "Track what politicians promise vs. what they deliver. Real voting records, campaign finance data, and executive actions — all in one place.",
  openGraph: {
    type: "website",
    siteName: "NoKool",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@nokool",
  },
  metadataBase: new URL("https://nokool.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${dmSerif.variable} ${jetbrains.variable} font-sans antialiased bg-brand-paper text-brand-charcoal`}
      >
        <Navbar />
        <div className="min-h-screen overflow-x-hidden">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
