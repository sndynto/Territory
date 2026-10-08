'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useShallow } from 'zustand/react/shallow';

import { TerritoryMap } from './map/TerritoryMap';
import { CountUp } from './CountUp';
import { useGame } from '@/store/useGame';
import { RARITY_COLOR, RARITY_MULT } from '@/lib/game';
import type { Rarity } from '@/lib/types';

const STEPS = [
  { n: '01', title: 'Stake a Chog', body: 'Lock your Chog NFT onto an empty hex to claim it as your territory and establish your garrison', tone: 'text-grape' },
  { n: '02', title: 'Farm $CHOG', body: 'Earn passive $CHOG yield from your claimed lands where rarer traits and richer biomes multiply your rewards', tone: 'text-mint' },
  { n: '03', title: 'Raid neighbours', body: 'Attack rival hexes by paying a small fee to roll the dice and instantly seize their land if you win', tone: 'text-rose' },
];

const FAQS = [
  { q: 'What is Territory?', a: 'Territory is an on-chain game where you use your Chog NFTs to claim land, battle other players, and earn $CHOG yield.' },
  { q: 'Do I need a Chog NFT to play?', a: 'Yes! Your Chog NFT acts as your playable character and proof of ownership. Without it, you cannot claim land or earn yield, but you can explore the map as a guest.' },
  { q: 'How does combat work?', a: 'You pay a small fee to attack a rival territory. The outcome is determined by your Chog\'s traits and a dice roll. If you win, you immediately seize the land.' },
  { q: 'What chain is this on?', a: 'Territory is built on Monad, ensuring high performance, low fees, and instant finality for all your conquests.' },
];

const MECHANICS = [
  { t: 'Attack Fee', d: 'Every raid costs 25 $CHOG to initiate. This fee ensures that spamming attacks is costly, forcing you to make strategic strikes.' },
  { t: 'Biome Bonuses', d: 'Lands have distinct biomes affecting stats. For example, Void Dunes offer 1.6x yield but lower defense, while Moss Hollow gives defensive bonuses.' },
  { t: 'Rarity Scaling', d: 'Your Chog\'s rarity directly multiplies your baseline yield, ranging from Common (1x) up to Legendary (2.1x) rewards.' },
  { t: 'Action Cooldowns', d: 'After a tile is captured or defended, it enters a 1-minute cooldown period. During this time it cannot be attacked, giving you time to breathe.' }
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 220, damping: 22 } } };

export function Hero() {
  const { territories, distributed, infoOpen, toggleInfo } = useGame(useShallow((s) => ({ 
    territories: s.territories, 
    distributed: s.distributed,
    infoOpen: s.infoOpen,
    toggleInfo: s.toggleInfo
  })));
  const claimed = territories.filter((t) => t.owner).length;
  const lords = new Set(territories.filter((t) => t.owner).map((t) => t.owner)).size;

  return (
    <>
      <section className="relative isolate flex h-[calc(100dvh-64px)] items-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_30%,#2a1558_0%,#0B0F19_65%)]">
          <div className="absolute inset-0 opacity-70">
            <TerritoryMap interactive={false} />
            
          </div>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-ink via-ink/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 pointer-events-none bg-gradient-to-t from-ink to-transparent" />
        </div>

        <motion.div variants={container} initial="hidden" animate="show" className="mx-auto w-full max-w-6xl px-6 py-16 pointer-events-none">
          <motion.div variants={item} className="chip mb-6 border-grape/40 text-grape pointer-events-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-grape" /> Chogathon 2026 A Built on Monad
          </motion.div>

          <motion.h1 variants={item} className="max-w-3xl font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">
            Every Chog is a deed.
            <span className="block bg-gradient-to-r from-grape via-ice to-coral bg-clip-text text-transparent">Go take the map</span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-xl text-lg text-white/70">
            Stake your Chog to conquer territories on a living map and earn daily $CHOG yield. Raid rival lands to expand your empire or watch from the sidelines if you don&apos;t hold one
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3 pointer-events-auto">
            <ConnectButton label="Connect Wallet" />
            <Link href="/play" className="btn-ghost">Enter the map</Link>
            <Link href="/play" onClick={() => useGame.getState().playGuest()} className="btn-ghost text-mint border-mint/20 hover:bg-mint/10">Try Demo</Link>
            <button onClick={() => useGame.getState().toggleInfo()} className="btn-ghost text-white/60 border-white/10 hover:text-white hover:border-white/20">How to Play</button>
          </motion.div>

          <motion.div variants={item} className="mt-12 grid max-w-2xl grid-cols-3 gap-3">
            {[
              { l: 'Territories claimed', v: claimed, c: 'text-grape' },
              { l: 'Active lords', v: lords, c: 'text-ice' },
              { l: '$CHOG distributed', v: distributed, c: 'text-mint' },
            ].map((s) => (
              <div key={s.l} className="panel p-4">
                <div className={`font-mono text-2xl font-bold sm:text-3xl ${s.c}`}><CountUp to={s.v} /></div>
                <div className="label mt-1">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <AnimatePresence>
        {infoOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-ink/95 backdrop-blur-xl">
            
            <button onClick={toggleInfo} className="fixed top-6 right-6 z-[60] h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors focus:outline-none">
              <span className="text-3xl leading-none">&times;</span>
            </button>

            <section className="mx-auto max-w-6xl px-6 py-24 md:py-32 relative">
              <div className="absolute inset-0 bg-grape/5 blur-[120px] pointer-events-none rounded-full" />
              
              <div className="text-center relative z-10">
                <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">Three moves for maximum mischief</h2>
                <p className="mt-4 text-white/60 max-w-xl mx-auto text-lg">Master the basics to dominate the map and build your empire.</p>
              </div>
              
              <div className="mt-16 grid gap-6 md:grid-cols-3 relative z-10">
                {STEPS.map((s, i) => (
                  <motion.div key={s.n} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }}
                    transition={{ delay: i * 0.1, type: 'spring', stiffness: 100, damping: 20 }} 
                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    className="relative group overflow-hidden panel p-8 border-white/5 hover:border-white/20 transition-colors bg-white/[0.02] hover:bg-white/[0.04]">
                    
                    <div className={`absolute -right-4 -top-8 text-9xl font-display font-black opacity-[0.03] group-hover:opacity-[0.08] transition-opacity ${s.tone}`}>{s.n}</div>
                    
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-inset ring-white/10 ${s.tone} mb-6`}>
                      <span className="font-mono text-lg font-bold">{s.n}</span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-white relative z-10">{s.title}</h3>
                    <p className="mt-3 text-white/60 leading-relaxed relative z-10">{s.body}</p>
                  </motion.div>
                ))}
              </div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
                className="mt-32 relative overflow-hidden panel p-8 md:p-12 border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent flex flex-col md:flex-row items-center gap-12">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-grape/20 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="flex-1 relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white/80 mb-4">
                    <span className="h-2 w-2 rounded-full bg-mint animate-pulse" /> On-chain Metadata
                  </div>
                  <h3 className="font-display text-3xl md:text-4xl font-bold">Traits are power</h3>
                  <p className="mt-4 text-lg text-white/65 leading-relaxed max-w-xl">
                    Your Chog&apos;s on-chain metadata directly dictates its combat stats and yield multiplier. Chaotic eyes hit harder while Sleepy eyes defend better, turning your NFT into a fully functional weapon and fortress.
                  </p>
                </div>
                <div className="relative z-10 flex flex-wrap gap-3 md:max-w-xs justify-center md:justify-end">
                  {(Object.keys(RARITY_MULT) as Rarity[]).map((r) => (
                    <motion.span 
                      key={r} 
                      whileHover={{ scale: 1.05 }}
                      className="chip px-4 py-2 text-sm font-bold shadow-lg backdrop-blur-sm" 
                      style={{ 
                        color: RARITY_COLOR[r], 
                        borderColor: RARITY_COLOR[r] + '55',
                        backgroundColor: RARITY_COLOR[r] + '15',
                        boxShadow: `0 0 20px ${RARITY_COLOR[r]}20`
                      }}>
                      {r} <span className="text-white/50 ml-1">x{RARITY_MULT[r]}</span>
                    </motion.span>
                  ))}
                </div>
              </motion.div>

              <div className="mt-32">
                <div className="text-center mb-16">
                  <h2 className="font-display text-4xl font-bold tracking-tight bg-gradient-to-br from-ice to-white/50 bg-clip-text text-transparent">Core Mechanics</h2>
                  <p className="mt-4 text-white/60 text-lg">The rules of engagement.</p>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  {MECHANICS.map((m, i) => (
                    <motion.div 
                      key={m.t} 
                      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} 
                      className="panel p-8 border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform pointer-events-none" />
                      <h3 className="font-display text-xl font-bold text-ice flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-ice rounded-full" />
                        {m.t}
                      </h3>
                      <p className="mt-3 text-white/70 leading-relaxed ml-4">{m.d}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="mt-32 mb-12">
                <div className="text-center mb-12">
                  <h2 className="font-display text-4xl font-bold tracking-tight">Frequently Asked Questions</h2>
                </div>
                <div className="mx-auto max-w-3xl flex flex-col gap-4">
                  {FAQS.map((faq, i) => (
                    <FaqItem key={i} faq={faq} index={i} />
                  ))}
                </div>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FaqItem({ faq, index }: { faq: { q: string; a: string }; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} 
      className={`panel overflow-hidden transition-all duration-300 ${open ? 'border-ice/30 bg-white/[0.04] shadow-[0_0_30px_rgba(255,255,255,0.03)]' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.03]'}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-6 md:p-8 text-left focus:outline-none">
        <h3 className={`font-display text-lg md:text-xl font-bold transition-colors ${open ? 'text-white' : 'text-white/80'}`}>{faq.q}</h3>
        <div className={`ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${open ? 'border-ice text-ice bg-ice/10' : 'border-white/10 text-white/50'}`}>
           {open ? '−' : '+'}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
            <p className="px-6 md:px-8 pb-6 md:pb-8 text-white/60 leading-relaxed">{faq.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
