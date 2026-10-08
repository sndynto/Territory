import type { Metadata } from 'next';
import { Chakra_Petch, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Navbar } from '@/components/Navbar';


import { Smartphone } from 'lucide-react';

import { SecurityBlocker } from '@/components/SecurityBlocker';

const fontMain = Chakra_Petch({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600', '700'] });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Territory — every Chog is a deed',
  description: 'A living on-chain map on Monad. CHOG. WORLD. ORDER. Stake your Chog, claim land, earn $CHOG, raid your neighbours.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontMain.variable} ${mono.variable}`}>
      <body>
        <SecurityBlocker />
        <Providers>
          {/* Desktop Content */}
          <div className="hidden md:block">
            <Navbar />
            {children}
          </div>

          {/* Mobile Blocker */}
          <div className="flex md:hidden h-[100dvh] flex-col items-center justify-center p-6 text-center bg-[radial-gradient(ellipse_at_30%_20%,#1a1240_0%,#0B0F19_60%)] relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-grape/10 blur-[64px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 mb-6 flex flex-col items-center">
              {/* Floating animated Chog placeholder */}
              <div className="relative h-24 w-24 animate-[bounce_3s_ease-in-out_infinite]">
                <div className="absolute inset-0 rounded-2xl bg-grape/20 blur-xl animate-pulse" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/api/chog/1/image.webp" 
                  alt="Chog Animation" 
                  className="relative h-full w-full rounded-2xl border-2 border-grape/30 object-cover shadow-2xl"
                />
              </div>
              <div className="mt-4 h-1.5 w-16 rounded-[100%] bg-black/40 blur-[2px] animate-[pulse_3s_ease-in-out_infinite]" />
            </div>

            <h2 className="relative z-10 font-display text-2xl font-bold tracking-tight text-white">Mobile Coming Soon</h2>
            <p className="relative z-10 mt-3 text-sm text-mist max-w-[280px] leading-relaxed">
              Territory is currently a desktop-first experience. Please visit us on your computer to claim sectors and wage war.
            </p>
          </div>
        </Providers>
      </body>
    </html>
  );
}
