import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { Header } from "@/components/Header";
import { getSettings } from "@/lib/settings";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--ff-display",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--ff-body",
});

// Storefront is data-driven (products, settings) — render dynamically rather
// than prerendering at build time (which would require a database during build).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: `${s.shopName} — Handmade Goods`,
    description: s.tagline,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSettings();
  // Runtime-gated (this layout is force-dynamic): only production sets
  // GA_MEASUREMENT_ID, so beta/dev never report analytics.
  const gaId = process.env.GA_MEASUREMENT_ID;

  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <CartProvider>
          <Header shopName={settings.shopName} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
          <footer className="stars mt-8 border-t-2 border-ink bg-space py-6 text-center text-sm font-semibold text-white/80">
            © {new Date().getFullYear()} {settings.shopName} · Handmade across the
            galaxy ☄️🐱
          </footer>
        </CartProvider>
      </body>
      {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
    </html>
  );
}
