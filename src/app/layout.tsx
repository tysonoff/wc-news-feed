import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthWidget from "@/components/AuthWidget";
import ThemeToggle from "@/components/ThemeToggle";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import { headers } from "next/headers";
import { getRegionBySlug, type Region } from "@/config/regions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

async function getCurrentRegion(): Promise<Region> {
  const requestHeaders = await headers();
  return getRegionBySlug(requestHeaders.get("x-wc-region"));
}

// Region-aware — replaces the old static `export const metadata` since
// title/description/OG tags now depend on which domain the request came
// in on (set by proxy.ts based on the Host header).
export async function generateMetadata(): Promise<Metadata> {
  const region = await getCurrentRegion();
  const siteName = `${region.displayName} News Feed`;
  const title = `${siteName} — ${region.displayName} News, All in One Place`;
  const description =
    region.slug === "national"
      ? "Live Canadian national news headlines from CBC, Global News, and other major outlets — updated hourly."
      : `Live ${region.displayName} news headlines from CBC, Global News, and local sources — updated hourly.`;
  const url = `https://${region.domain}`;

  return {
    metadataBase: new URL(url),
    title,
    description,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      locale: "en_CA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets content extend into (and safely pad around) notches and home
  // indicators once this runs without browser chrome, e.g. wrapped as
  // a native app.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const region = await getCurrentRegion();
  const siteName = `${region.displayName} News Feed`;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{
        // Exposed as CSS variables so any component can pick up the
        // active region's brand colors without prop-drilling them
        // through the tree.
        ["--brand-primary" as string]: region.brandPrimaryColor,
        ["--brand-accent" as string]: region.brandAccentColor,
      } as React.CSSProperties}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: siteName,
              url: `https://${region.domain}`,
              description: `Live ${region.displayName} news headlines from CBC, Global News, and other local sources, updated hourly.`,
            }),
          }}
        />
        {/* Runs before the page paints, so there's no flash of the wrong
            theme. Uses a saved preference if there is one, otherwise
            falls back to the system setting. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var saved = localStorage.getItem('theme');
                  var isDark = saved
                    ? saved === 'dark'
                    : window.matchMedia('(prefers-color-scheme: dark)').matches;
                  document.documentElement.classList.toggle('dark', isDark);
                  document.documentElement.classList.toggle('light', !isDark);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <header className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition">
              <svg width="36" height="36" viewBox="0 0 100 100" aria-hidden="true">
                <rect width="100" height="100" rx="20" fill={region.brandPrimaryColor} stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                <circle cx="50" cy="38" r="16" fill={region.brandAccentColor} />
                <line x1="24" y1="66" x2="76" y2="66" stroke={region.brandAccentColor} strokeWidth="6" strokeLinecap="round" />
              </svg>
              <span className="flex flex-col leading-none">
                <span className="text-base font-extrabold" style={{ color: region.brandPrimaryColor }}>{region.displayName}</span>
                <span className="text-[11px] font-bold tracking-wide" style={{ color: region.brandPrimaryColor }}>News Feed</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <AuthWidget />
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-gray-200 dark:border-gray-700 py-6 px-4 text-center text-xs text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
          <div className="flex gap-4">
            <a href="/about" className="hover:underline">About</a>
            <a href="/contact" className="hover:underline">Contact</a>
            <a href="/privacy" className="hover:underline">Privacy Policy</a>
          </div>
          <span>&copy; {new Date().getFullYear()} {siteName}</span>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}