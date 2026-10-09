'use client';

import { useEffect, useState } from 'react';
import type { Chog } from '@/lib/types';

// Use server-side proxy to avoid CORS + client-side IPFS failures
const proxyUrl = (id: number) =>
  `/api/chog/${Math.max(1, Math.min(1969, id))}/image.webp`;

// Direct IPFS gateways as final fallback (Cloudflare first — fastest)
const CHOG_IMG_CID = 'bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e';
const directUrl = (id: number, gw: number) => {
  const gateways = [
    `https://cloudflare-ipfs.com/ipfs/${CHOG_IMG_CID}`,
    `https://gateway.pinata.cloud/ipfs/${CHOG_IMG_CID}`,
  ];
  return `${gateways[gw % gateways.length]}/${Math.max(1, Math.min(1969, id))}.webp`;
};

type LoadState = 'proxy' | 'direct0' | 'direct1' | 'failed';

export function ChogAvatar({ chog, size = 56 }: { chog: Chog; size?: number }) {
  const [state, setState] = useState<LoadState>('proxy');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState('proxy');
    setLoaded(false);
  }, [chog.id]);

  const src =
    state === 'proxy' ? proxyUrl(chog.id) :
    state === 'direct0' ? directUrl(chog.id, 0) :
    state === 'direct1' ? directUrl(chog.id, 1) : null;

  const next = () =>
    setState((s) =>
      s === 'proxy' ? 'direct0' :
      s === 'direct0' ? 'direct1' : 'failed'
    );

  if (state === 'failed' || !src) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-xl bg-grape/30 border border-grape/40 flex items-center justify-center text-white/60 font-mono text-xs"
      >
        #{chog.id}
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size }} className="relative rounded-xl overflow-hidden">
      {/* Shimmer placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse rounded-xl" />
      )}
      <img
        key={`${chog.id}-${state}`}
        src={src}
        alt={chog.name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        className={`rounded-xl object-cover border border-white/10 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={next}
      />
    </div>
  );
}
