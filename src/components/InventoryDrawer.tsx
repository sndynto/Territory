'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useGame } from '@/store/useGame';
import { deriveChog } from '@/lib/game';
import { ChogCard } from './ChogCard';

const MINT_URL = process.env.NEXT_PUBLIC_CHOG_MINT_URL;

export function InventoryDrawer() {
  const { open, setDrawer, chogs, territories, me } = useGame(
    useShallow((s) => ({ open: s.drawerOpen, setDrawer: s.setDrawer, chogs: s.chogs, territories: s.territories, me: s.me })),
  );
  const { isConnected } = useAccount();
  const staked = territories.filter((t) => t.owner && t.owner === me && t.chogId != null);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="panel fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col rounded-r-none p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Your Chogs</h2>
              <button className="btn-ghost !px-3 !py-1" onClick={() => setDrawer(false)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto pr-1">
              {!isConnected ? (
                <div className="py-12 flex flex-col items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-grape/10 border border-grape/20">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-grape">
                      <rect x="3" y="11" width="18" height="11" rx="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-sm font-bold text-white">Wallet not connected</p>
                    <p className="mt-1 text-[11px] text-mist">Connect to load your Chog roster</p>
                  </div>
                  <ConnectButton />
                </div>
              ) : chogs.length + staked.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-mist">
                      <circle cx="12" cy="12" r="9"/><path d="M9 9h.01M15 9h.01M9 15c.83 1 2 1.5 3 1.5s2.17-.5 3-1.5"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-sm font-bold text-white">No Chogs found</p>
                    <p className="mt-1 text-[11px] text-mist max-w-[200px]">This wallet holds no Chog Genesis NFTs on Monad.</p>
                  </div>
                  {MINT_URL && <a className="btn-primary text-sm !py-2 !px-5" href={MINT_URL} target="_blank" rel="noreferrer">Get Chog Genesis NFT</a>}
                </div>
              ) : (
                <>
                  <section>
                    <div className="label mb-2">In wallet · ready ({chogs.length})</div>
                    <div className="space-y-2">{chogs.map((c) => <ChogCard key={c.id} chog={c} />)}</div>
                  </section>
                  <section>
                    <div className="label mb-2">Staked · ruling land ({staked.length})</div>
                    <div className="space-y-2">
                      {staked.map((t) => (
                        <ChogCard
                          key={t.id}
                          chog={deriveChog(t.chogId!)}
                          status={`Ruling ${t.name}`}
                          onClick={() => { useGame.getState().select(t.id); setDrawer(false); }}
                        />
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
