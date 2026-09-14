import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'LexiGuard | Evidence-First Legal Document Intelligence',
  description:
    'Evidence-grounded contract analysis, obligation tracking, semantic clause comparison, and lawyer preparation navigator.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  headers().get('x-nonce');

  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col antialiased text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950">
        {/* Accessible Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
