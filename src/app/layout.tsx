import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { Header } from "@/components/Header";
import { SHOP_NAME, SHOP_TAGLINE } from "@/lib/brand";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--ff-display",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--ff-body",
});

export const metadata: Metadata = {
  title: `${SHOP_NAME} — Handmade Goods`,
  description: SHOP_TAGLINE,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <CartProvider>
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
          <footer className="stars mt-8 border-t-2 border-ink bg-space py-6 text-center text-sm font-semibold text-white/80">
            © {new Date().getFullYear()} {SHOP_NAME} · Handmade across the galaxy ☄️🐱
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
