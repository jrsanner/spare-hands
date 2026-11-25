import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spare Hands",
  description: "Quick, verified help for small jobs in Greensburg.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-stone-50 text-stone-900 antialiased">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight text-emerald-800">
              Spare Hands
            </Link>
            <span className="text-xs text-stone-500">Greensburg, PA</span>
          </div>
        </header>
        <main className="mx-auto max-w-xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
