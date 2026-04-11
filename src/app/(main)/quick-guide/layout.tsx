import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideSidebar } from './GuideSidebar';

export const metadata: Metadata = {
  openGraph: {
    siteName: 'BünzliFight',
    images: [{ url: '/opengraph-image.png', width: 643, height: 900, alt: 'BünzliFight Handbuch – Gemeinde Simulator Schweiz' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/opengraph-image.png'],
  },
};

export default function QuickGuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      {/* Background */}
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-emerald-400/5 blur-[120px]" />
        <div className="absolute bottom-[15%] right-[8%] w-80 h-80 rounded-full bg-cyan-400/5 blur-[130px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent z-10" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-10 pb-20">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-200 transition-colors group text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform duration-300">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            buenzlifight.ch
          </Link>
          <div className="text-center">
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-[0.3em]">BünzliFight</p>
            <p className="text-white text-sm font-display font-semibold">Handbuch</p>
          </div>
          <Link
            href="/quick-guide"
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors hidden sm:block"
          >
            Übersicht
          </Link>
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden mb-6">
          <GuideSidebar />
        </div>

        {/* Main layout */}
        <div className="flex gap-10 items-start">
          {/* Desktop sidebar */}
          <div className="hidden lg:block sticky top-8">
            <GuideSidebar />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-white/10 text-center">
          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 mb-2">
            <a
              href="https://discord.gg/fSKcZrABEG"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#5865F2] hover:text-[#7289DA] transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
              Discord
            </a>
            <span className="text-white/10">|</span>
            <Link href="/impressum" className="hover:text-amber-200 transition-colors">Impressum</Link>
            <span className="text-white/10">|</span>
            <Link href="/datenschutz" className="hover:text-amber-200 transition-colors">Datenschutz</Link>
            <span className="text-white/10">|</span>
            <Link href="/faq" className="hover:text-amber-200 transition-colors">FAQ</Link>
          </div>
          <p className="text-slate-600 text-[10px]">BünzliFight &copy; 2026</p>
        </div>
      </div>
    </div>
  );
}
