'use client';

import Link from 'next/link';
import { useShallow } from 'zustand/react/shallow';
import { Swords, Shield, Zap, Flame, Map as MapIcon, Link as LinkIcon, User } from 'lucide-react';
import { CountUp } from '@/components/CountUp';
import { ChogAvatar } from '@/components/ChogAvatar';
import { useGame } from '@/store/useGame';
import { deriveChog, ownerLabel, pendingYield, tileDefense, tileYield } from '@/lib/game';
import { useNow } from '@/lib/hooks';
import { useActions } from '@/lib/useActions';

const KIND_ICON = {
  claim: <MapIcon className="w-4 h-4 text-mint" />,
  attack: <Swords className="w-4 h-4 text-rose-400" />,
  defend: <Shield className="w-4 h-4 text-ice" />,
  harvest: <Zap className="w-4 h-4 text-amber-400" />,
  raid: <Flame className="w-4 h-4 text-rose-500" />
};

export default function Dashboard() {
  const { territories, me, history, earned } = useGame(
    useShallow((s) => ({ territories: s.territories, me: s.me, history: s.history, earned: s.earned })),
  );
  const now = useNow();
  const { harvest } = useActions();

  const mine = territories.filter((t) => t.owner && t.owner === me);
  const pending = Math.floor(mine.reduce((a, t) => a + pendingYield(t, now), 0));

  const board = new Map<string, { name: string; color: string; power: number; tiles: number }>();
  territories.forEach((t) => {
    if (!t.owner) return;
    const e = board.get(t.owner) ?? { name: ownerLabel(t, me), color: t.ownerColor, power: 0, tiles: 0 };
    e.power += tileDefense(t) + (t.chogId ? deriveChog(t.chogId).attack : 0);
    e.tiles += 1;
    board.set(t.owner, e);
  });
  const ranked = [...board.entries()].sort((a, b) => b[1].power - a[1].power);
  const rank = ranked.findIndex(([addr]) => addr === me) + 1;

  const stats = [
    { label: 'Territories Controlled', value: mine.length, tone: 'text-grape' },
    { label: '$CHOG Collected', value: Math.floor(earned), tone: 'text-mint' },
    { label: 'Pending Yield', value: pending, tone: 'text-coral' },
    { label: 'Global Rank', value: rank, tone: 'text-ice', prefix: '#' },
  ];

  if (!me) {
    return (
      <main className="mx-auto max-w-xl px-6 py-32 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 border border-white/10 text-mist">
          <User className="h-10 w-10" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Wallet Not Connected</h1>
        <p className="mt-3 text-mist">Please connect your wallet to view your territories, stats, and power ranking.</p>
        <Link href="/play" className="btn-primary mt-8 inline-flex items-center gap-2">
          <MapIcon className="w-4 h-4" /> Go to Map
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">Player Dashboard</h1>
        <p className="text-sm text-mist mt-1">Manage your territories, claim yields, and track your ranking.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel p-5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="label relative z-10">{s.label}</div>
            <div className={`mt-2 font-mono text-3xl font-bold ${s.tone} relative z-10`}>
              {s.prefix}
              {s.value > 0 || s.label !== 'Global Rank' ? <CountUp to={s.value} /> : '—'}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel flex flex-col">
          <div className="flex items-center justify-between border-b border-white/5 p-5">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-grape" /> My Territories
            </h2>
            <button 
              className="btn-mint !py-1.5 !px-4 !text-sm transition-transform active:scale-95" 
              disabled={pending < 1} 
              onClick={() => harvest(mine.map((t) => t.id))}
            >
              Harvest All
            </button>
          </div>
          
          <div className="flex-1 p-5">
            {mine.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center text-mist">
                <MapIcon className="mb-3 h-10 w-10 opacity-20" />
                <p>No active territories found.</p>
                <Link href="/play" className="mt-2 text-ice hover:underline transition-colors">Find land to claim</Link>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {mine.map((t) => (
                  <li key={t.id} className="flex items-center gap-4 py-4 group">
                    {t.chogId && <ChogAvatar chog={deriveChog(t.chogId)} size={48} />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display font-bold text-base group-hover:text-ice transition-colors">{t.name}</div>
                      <div className="font-mono text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>{t.biome}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span>DEF {tileDefense(t)}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span>{tileYield(t)}/day</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-medium text-mint">+{Math.floor(pendingYield(t, now))}</div>
                      <button className="text-xs text-mist hover:text-white underline mt-1 transition-colors" onClick={() => harvest([t.id])}>Harvest</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="panel">
            <div className="border-b border-white/5 p-5">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-ice" /> Leaderboard
              </h2>
            </div>
            <div className="p-5">
              <ol className="space-y-3">
                {ranked.slice(0, 6).map(([addr, e], i) => (
                  <li key={addr} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <span className="w-5 font-mono text-mist text-center">{i + 1}</span>
                    <span className="h-3 w-3 rounded-sm shrink-0 border border-white/10" style={{ background: e.color }} />
                    <span className={`flex-1 truncate ${addr === me ? 'font-bold text-ice' : 'text-slate-300'}`}>{e.name}</span>
                    <span className="font-mono text-xs text-mist bg-white/5 px-2 py-0.5 rounded">{e.tiles} tiles</span>
                    <span className="font-mono font-medium text-grape">{e.power}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="panel flex flex-col h-80">
            <div className="border-b border-white/5 p-5">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Swords className="w-5 h-5 text-rose-400" /> Activity Log
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {history.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-sm text-mist text-center">
                  <Flame className="mb-2 h-6 w-6 opacity-20" />
                  No battle history found.
                </div>
              ) : (
                <ul className="space-y-3 pr-1">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-start gap-3 text-sm border-l-2 border-white/10 pl-3 py-1">
                      <span className="mt-0.5 shrink-0">{KIND_ICON[h.kind as keyof typeof KIND_ICON]}</span>
                      <span className={`flex-1 leading-snug ${h.won === false || h.kind === 'raid' ? 'text-rose-300' : 'text-slate-300'}`}>
                        {h.text}
                      </span>
                      {h.amount ? <span className="font-mono text-xs font-medium text-mint bg-mint/10 px-1.5 py-0.5 rounded">+{h.amount}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="panel p-5 bg-gradient-to-br from-[#A855F7]/10 to-transparent border-[#A855F7]/20">
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-grape" /> About Chog Genesis
            </h2>
            <p className="mt-2 text-xs text-mist leading-relaxed">
              A culture-driven NFT project built on Monad. The Genesis collection features 1,969 unique characters competing for territory.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <a href="https://chog.xyz/" target="_blank" rel="noreferrer" className="btn-ghost flex justify-center !py-2 !bg-black/20 hover:!bg-white/10">Website</a>
              <a href="https://x.com/chog_xyz" target="_blank" rel="noreferrer" className="btn-ghost flex justify-center !py-2 !bg-black/20 hover:!bg-white/10">Twitter (X)</a>
              <a href="https://discord.gg/chog" target="_blank" rel="noreferrer" className="btn-ghost flex justify-center !py-2 !bg-black/20 hover:!bg-white/10">Discord</a>
              <a href="https://opensea.io/collection/chog-genesis" target="_blank" rel="noreferrer" className="btn-ghost flex justify-center !py-2 !bg-black/20 hover:!bg-white/10">OpenSea</a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
