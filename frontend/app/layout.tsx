import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sertifikat Digital — Verifikasi Blockchain",
  description:
    "Sistem verifikasi keaslian sertifikat akademik berbasis blockchain Ethereum Sepolia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        {/* Navbar */}
        <header className="sticky top-0 z-50 border-b border-indigo-100/80 bg-white/80 backdrop-blur-md shadow-sm">
          <div className="mx-auto max-w-5xl px-4 flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/verify" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center shadow-sm">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <span className="font-bold text-slate-800 text-sm tracking-tight group-hover:text-indigo-600 transition-colors">
                SertifikatChain
              </span>
            </Link>

            {/* Nav links */}
            <nav className="flex items-center gap-1">
              <Link
                href="/verify"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                Verifikasi
              </Link>
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                Admin
              </Link>
              {/* Chain indicator */}
              <div className="ml-2 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium text-emerald-700">Sepolia</span>
              </div>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200/80 bg-white/60 backdrop-blur-sm py-6 mt-8">
          <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded gradient-hero flex items-center justify-center">
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="font-medium text-slate-500">SertifikatChain</span>
              <span>— Verifikasi berbasis Ethereum Blockchain</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Sepolia Etherscan</a>
              <span>·</span>
              <span>{new Date().getFullYear()}</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
