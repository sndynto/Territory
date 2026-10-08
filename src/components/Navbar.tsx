'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Volume2, VolumeX } from 'lucide-react';
import { useGame } from '@/store/useGame';

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="#1b1340" stroke="#A855F7" strokeWidth="1.5" />
        {[-50, -25, 0, 25, 50].map((deg) => (
          <polygon key={deg} points="13,13 16,5 19,13" fill="#22D3EE" transform={`rotate(${deg} 16 18)`} />
        ))}
        <ellipse cx="16" cy="19" rx="6" ry="5" fill="#F8FAFC" />
        <circle cx="18" cy="18" r="1" fill="#0B0F19" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">Territory</span>
    </span>
  );
}

export function Navbar() {
  const path = usePathname();
  const soundOn = useGame((s) => s.soundOn);
  const toggleSound = useGame((s) => s.toggleSound);
  const infoOpen = useGame((s) => s.infoOpen);
  const toggleInfo = useGame((s) => s.toggleInfo);

  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${path === href ? 'bg-white/10 text-white' : 'text-mist hover:text-white'}`}
    >
      {label}
    </Link>
  );

  return (
    <header className="relative z-40 flex h-16 items-center justify-between border-b border-white/5 bg-ink/80 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2 md:gap-6">
        <Link href="/" className="hidden sm:block"><Logo /></Link>
        <nav className="flex items-center gap-1">
          {link('/play', 'Map')}
          {link('/dashboard', 'Profile')}
          <button 
            onClick={toggleInfo}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${infoOpen ? 'bg-white/10 text-white' : 'text-mist hover:text-white'}`}
          >
            How to Play
          </button>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-mist transition hover:bg-white/10 hover:text-white"
          onClick={toggleSound}
          aria-label="Toggle sound"
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
      </div>
    </header>
  );
}
