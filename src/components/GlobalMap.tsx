'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useRef, useEffect } from 'react';

const TerritoryMap = dynamic(() => import('@/components/map/TerritoryMap').then(m => m.TerritoryMap), { ssr: false });

export function GlobalMap() {
  const path = usePathname();
  const isPlay = path === '/play';
  const isHome = path === '/';

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        zIndex: isPlay ? 0 : -10,
        opacity: isHome ? 0.7 : (isPlay ? 1 : 0),
        pointerEvents: isPlay ? 'auto' : 'none',
        visibility: (!isHome && !isPlay) ? 'hidden' : 'visible'
      }}
    >
      <TerritoryMap interactive={isPlay} />
    </div>
  );
}
