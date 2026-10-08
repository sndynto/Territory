'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import dynamic from 'next/dynamic';
const TerritoryMap = dynamic(() => import('@/components/map/TerritoryMap').then(m => m.TerritoryMap), { ssr: false });
import { TerritoryPanel } from '@/components/TerritoryPanel';
import { InventoryDrawer } from '@/components/InventoryDrawer';
import { BattleModal } from '@/components/BattleModal';
import { useGame } from '@/store/useGame';
import { isAdjacentToMine, pendingYield } from '@/lib/game';
import { useNow } from '@/lib/hooks';
import { useActions } from '@/lib/useActions';
import { Zap, Swords, MapPin, XCircle, AlertCircle, Loader2, Flame, Shield, Map } from 'lucide-react';

// ─── Raid cycle: 45s ──────────────────────────────────────────────────────────
const RAID_CYCLE_MS = 45_000;

/** Real-time live yield ticker formatted as a string */
function useLiveYield() {
  const { territories, me } = useGame(useShallow((s) => ({ territories: s.territories, me: s.me })));
  const now = useNow();
  const mine = territories.filter((t) => t.owner && t.owner === me);
  return {
    pending: Math.floor(mine.reduce((a, t) => a + pendingYield(t, now), 0)),
    mine,
  };
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function Hud() {
  const { me, chogs, balance, setDrawer } = useGame(
    useShallow((s) => ({ me: s.me, chogs: s.chogs, balance: s.balance, setDrawer: s.setDrawer })),
  );
  const { harvest } = useActions();
  const { pending, mine } = useLiveYield();

  // Live balance ticker: shows balance + pending yield counting up
  const liveBalance = balance + pending;

  // Raid timer: seconds until next raid tick (45s cycle from page load)
  const startRef = useRef(Date.now());
  const [raidIn, setRaidIn] = useState(RAID_CYCLE_MS / 1000);
  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) % RAID_CYCLE_MS;
      setRaidIn(Math.ceil((RAID_CYCLE_MS - elapsed) / 1000));
    }, 500);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
      {/* Territory count */}
      <span className="chip pointer-events-auto">{mine.length} territories</span>

      {/* Live balance (counts up with pending yield) */}
      <span className="chip pointer-events-auto text-mint" title={`+${pending} pending yield`}>
        {liveBalance.toLocaleString('en-US')}
        <span className="ml-1 text-mist">$CHOG</span>
        {pending > 0 && (
          <span className="ml-1 font-mono text-[10px] text-mint/60 animate-pulse">
            +{pending}
          </span>
        )}
      </span>

      {/* Harvest all */}
      {mine.length > 0 && (
        <button
          className="btn-mint pointer-events-auto !py-1.5 !text-sm"
          disabled={pending < 1}
          onClick={() => harvest(mine.map((t) => t.id))}
        >
          Harvest all · +{pending.toLocaleString('en-US')}
        </button>
      )}

      {/* Chog inventory */}
      <button className="btn-ghost pointer-events-auto !py-1.5 !text-sm" onClick={() => setDrawer(true)}>
        Chogs ({chogs.length + mine.length})
      </button>

      {/* Dashboard link */}
      <Link href="/dashboard" className="btn-ghost pointer-events-auto !py-1.5 !text-sm">Dashboard</Link>

      {/* Raid countdown chip */}
      {me && mine.length > 0 && (
        <span
          className="chip pointer-events-auto font-mono text-xs flex items-center"
          style={{ color: raidIn <= 5 ? '#f43f5e' : '#fb923c' }}
          title="Next potential raid tick"
        >
          <Flame className="w-3 h-3 mr-1" /> Raid in {raidIn}s
        </span>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast() {
  const notice = useGame((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useGame.setState({ notice: null }), 5500);
    return () => clearTimeout(t);
  }, [notice]);

  const tone = { good: 'border-mint/50', bad: 'border-rose/60', chaos: 'border-coral/60' };
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.id}
          initial={{ y: -30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className={`panel absolute left-1/2 top-16 z-30 -translate-x-1/2 border px-4 py-2.5 text-sm ${tone[notice.tone]}`}
        >
          {notice.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── FAB: Floating Action Button ─────────────────────────────────────────────
function FloatingActionButton() {
  const { me, territories, chogs, selectedId } = useGame(
    useShallow((s) => ({ me: s.me, territories: s.territories, chogs: s.chogs, selectedId: s.selectedId })),
  );
  const { claim, attack, harvest } = useActions();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // FAB only shows when connected and a tile is selected
  const tile = selectedId !== null ? territories[selectedId] : null;
  const show = !!me && !!tile;

  // Determine tile state relative to current user
  const isMine = !!tile?.owner && tile.owner === me;
  const isRival = !!tile?.owner && tile.owner !== me;
  const isUnclaimed = !tile?.owner;

  // Claimable = unclaimed AND adjacent to my territory
  const isClaimable = isUnclaimed && !!me && isAdjacentToMine(tile?.id ?? -1, territories, me);

  // Pick best available chog for the action
  const availableChogs = chogs; // chogs in wallet (not deployed)
  const firstChog = availableChogs[0] ?? null;
  const strongestChog = availableChogs.length
    ? availableChogs.reduce((best, c) => (c.attack > best.attack ? c : best), availableChogs[0])
    : null;

  const doAction = async () => {
    if (!tile || busy) return;
    setErr(null);
    setBusy(true);
    try {
      if (isMine) {
        // Harvest this single tile
        await harvest([tile.id]);
      } else if (isRival && strongestChog) {
        // Attack with strongest chog
        await attack(tile.id, strongestChog);
      } else if (isClaimable && firstChog) {
        // Claim with first available chog
        await claim(tile.id, firstChog.id);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Action failed';
      setErr(msg.slice(0, 60));
    } finally {
      setBusy(false);
    }
  };

  // Determine button appearance
  let btnLabel: React.ReactNode = null;
  let btnClass = '';
  let canAct = false;

  if (isMine) {
    btnLabel = busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Harvest</span>;
    btnClass = 'btn-mint';
    canAct = true;
  } else if (isRival && strongestChog) {
    btnLabel = busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <span className="flex items-center gap-2"><Swords className="w-4 h-4" /> Attack (ATK {strongestChog.attack})</span>;
    btnClass = 'btn-danger';
    canAct = true;
  } else if (isClaimable && firstChog) {
    btnLabel = busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <span className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Claim</span>;
    btnClass = 'btn-primary';
    canAct = true;
  } else if (isUnclaimed && !isClaimable) {
    btnLabel = <span className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Not adjacent</span>;
    btnClass = 'btn-ghost';
    canAct = false;
  } else if ((isRival || isUnclaimed) && !availableChogs.length) {
    btnLabel = <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> No Chogs available</span>;
    btnClass = 'btn-ghost';
    canAct = false;
  }

  if (!show || !btnLabel) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={`fab-${selectedId}`}
          initial={{ y: 20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 16, opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          // Mobile: above the panel (panel is max-h-[52%] at bottom)
          // Desktop: right side, above panel
          className="pointer-events-none absolute bottom-[calc(52%+16px)] left-1/2 z-20 -translate-x-1/2 lg:bottom-6 lg:left-auto lg:right-[376px] lg:translate-x-0"
        >
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            {err && (
              <div className="rounded-md bg-rose/20 border border-rose/40 px-3 py-1 text-xs text-rose max-w-[220px] text-center">
                {err}
              </div>
            )}
            <button
              className={`${btnClass} !rounded-full !px-5 !py-2.5 text-sm font-semibold shadow-xl`}
              onClick={doAction}
              disabled={!canAct || busy}
            >
              {btnLabel}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PlayPage() {
  return (
    <main className="relative h-[calc(100dvh-64px)] overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#1a1240_0%,#0B0F19_60%)]">
      
      <TerritoryMap interactive />
      <Hud />
      <Toast />
      <FloatingActionButton />
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 max-h-[52%] lg:inset-y-3 lg:left-auto lg:right-3 lg:max-h-none lg:w-[360px]">
        <div className="pointer-events-auto h-full">
          <TerritoryPanel />
        </div>
      </div>
      <InventoryDrawer />
      <BattleModal />
    </main>
  );
}
