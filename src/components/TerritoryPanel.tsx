'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AnimatePresence, motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Shield, Swords, Coins, MapPin, Zap, TrendingUp, Users, Radar, Hexagon, Map as MapIcon, TreePine, Gem, Flame, Leaf, Wind } from 'lucide-react';

const BIOME_ICONS: Record<string, React.ReactNode> = {
  TreePine: <TreePine className="w-3 h-3 inline-block" />,
  Gem: <Gem className="w-3 h-3 inline-block" />,
  Flame: <Flame className="w-3 h-3 inline-block text-rose-400" />,
  Leaf: <Leaf className="w-3 h-3 inline-block text-mint" />,
  Wind: <Wind className="w-3 h-3 inline-block text-ice" />
};

import { useGame } from '@/store/useGame';
import {
  ATTACK_FEE, BIOMES, FUR_COLOR, deriveChog, isAdjacentToMine, neighbors, ownerLabel,
  pendingYield, powerNotes, tileDefense, tileYield, winChance,
} from '@/lib/game';
import { DEMO } from '@/lib/contracts';
import { useNow } from '@/lib/hooks';
import { useActions } from '@/lib/useActions';
import { ChogAvatar } from './ChogAvatar';
import { ChogPicker } from './ChogCard';
import { CountUp } from './CountUp';

const MINT_URL = process.env.NEXT_PUBLIC_CHOG_MINT_URL;

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
function Stat({ label, value, tone, icon }: { label: string; value: React.ReactNode; tone: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="text-mist">{icon}</span>
        <span className="label">{label}</span>
      </div>
      <div className={`mt-0.5 font-mono text-lg font-bold ${tone}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Power-breakdown tooltip on hover for ATK / DEF numbers
// ---------------------------------------------------------------------------
function PowerTooltip({ notes, children }: { notes: string[]; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-xl border border-white/10 bg-ink/95 p-2.5 text-left shadow-xl backdrop-blur-md"
          >
            {notes.map((n) => (
              <p key={n} className="font-mono text-[10px] leading-5 text-mist">
                • {n}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Win-chance label helper
// ---------------------------------------------------------------------------
function oddsLabel(odds: number): { text: string; color: string } {
  if (odds >= 0.65) return { text: 'Favorable', color: 'text-mint' };
  if (odds >= 0.48) return { text: 'Even odds', color: 'text-sand' };
  return { text: 'High risk', color: 'text-rose' };
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export function TerritoryPanel() {
  const { t, me, chogs, balance, territories } = useGame(
    useShallow((s) => ({
      t: s.selectedId === null ? null : s.territories[s.selectedId],
      me: s.me, chogs: s.chogs, balance: s.balance, territories: s.territories,
    })),
  );
  const { isConnected } = useAccount();
  const act = useActions();
  const now = useNow();
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setPick(null); setErr(null); }, [t?.id]);

  // Fetch real metadata for the viewed territory's garrison and selected attacker
  useEffect(() => {
    import('@/lib/game').then(({ fetchChogMeta }) => {
      if (t?.chogId) fetchChogMeta(t.chogId);
      if (pick) fetchChogMeta(pick);
    });
  }, [t?.chogId, pick]);

  const chog = chogs.find((c) => c.id === pick) ?? null;
  const rival = !!t?.owner && t.owner !== me;
  const adjacent = t ? isAdjacentToMine(t.id, territories, me) : false;
  const adjacentTiles = t ? neighbors(t.id, territories) : [];

  // Count of the player's own adjacent tiles for strategic display
  const myAdjacentCount = useMemo(
    () => (t && me ? adjacentTiles.filter((nid) => territories[nid]?.owner === me).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t?.id, me],
  );

  const odds = useMemo(
    () => (chog && t && rival ? winChance(chog, t) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chog, t?.id, t?.chogId, rival],
  );

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setErr(null);
    try { await fn(); setPick(null); }
    catch (e) {
      const m = e as { shortMessage?: string; message?: string };
      setErr(m.shortMessage ?? m.message ?? 'Something went sideways.');
    } finally { setBusy(false); }
  }

  // ── Empty state: Mini Leaderboard ────────────────────────────────────────
  if (!t) {
    // Build leaderboard: group territories by owner
    type LordEntry = { name: string; color: string; count: number; chogId: number | null };
    const ownerMap: Map<string, LordEntry> = new Map();
    territories.forEach((ter) => {
      if (!ter.owner) return;
      const prev = ownerMap.get(ter.owner);
      if (prev) {
        prev.count++;
        if (!prev.chogId && ter.chogId != null) prev.chogId = ter.chogId;
      } else {
        ownerMap.set(ter.owner, { name: ter.ownerName ?? ter.owner.slice(0, 6), color: ter.ownerColor ?? '#A855F7', count: 1, chogId: ter.chogId ?? null });
      }
    });
    const leaderboard: ({ addr: string } & LordEntry)[] = Array.from(ownerMap.entries())
      .map(([addr, d]: [string, LordEntry]) => ({ addr, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalClaimed = territories.filter(ter => ter.owner).length;
    const totalTerritories = territories.length;
    const unclaimed = totalTerritories - totalClaimed;

    const rankStyle = ['text-amber-400', 'text-slate-300', 'text-orange-600'];
    const rankLabel = ['1ST', '2ND', '3RD', '4TH', '5TH'];
    const rankBg = [
      'bg-amber-400/10 border-amber-400/20',
      'bg-slate-400/5 border-slate-400/10',
      'bg-orange-600/5 border-orange-600/10',
      'bg-white/[0.02] border-white/5',
      'bg-white/[0.02] border-white/5',
    ];

    return (
      <div className="panel flex flex-col p-4 relative overflow-hidden bg-gradient-to-b from-ink to-ink/60">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-grape/10 blur-[48px] pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-grape/20 border border-grape/30 text-grape">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="font-display text-sm font-bold text-white">Global Leaderboard</div>
              <div className="text-[10px] text-mist font-mono">{totalClaimed}/{totalTerritories} sectors claimed</div>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-white/5 border border-white/10 px-2 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
            <span className="text-[10px] font-mono text-mint">LIVE</span>
          </div>
        </div>

        {/* Leaderboard rows */}
        <div className="relative z-10 flex flex-col gap-1.5">
          {leaderboard.length === 0 ? (
            <div className="py-6 text-center text-mist text-sm">No lords yet. Be the first.</div>
          ) : (
            leaderboard.map((lord, i) => {
              const isMe = lord.addr === me;
              return (
                <motion.div
                  key={lord.addr}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${rankBg[i]} ${isMe ? 'ring-1 ring-grape/40' : ''}`}
                >
                  {/* Rank */}
                  <div className={`w-7 text-center font-mono text-[9px] font-bold shrink-0 ${rankStyle[i] ?? 'text-mist'}`}>
                    {rankLabel[i]}
                  </div>

                  {/* Chog avatar */}
                  <div
                    className="h-8 w-8 rounded-lg shrink-0 overflow-hidden border flex items-center justify-center text-[10px] font-mono font-bold"
                    style={{ backgroundColor: lord.color + '22', borderColor: lord.color + '44', color: lord.color }}
                  >
                    {lord.chogId != null ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/chog/${lord.chogId}/image.webp`}
                        alt={`Chog #${lord.chogId}`}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <Users className="w-3.5 h-3.5" />
                    )}
                  </div>

                  {/* Name & count */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{isMe ? 'You' : lord.name}</span>
                      {isMe && <span className="text-[9px] bg-grape/30 text-grape px-1 rounded font-mono">YOU</span>}
                    </div>
                    <div className="text-[10px] text-mist font-mono">{lord.count} territories</div>
                  </div>

                  {/* Territory bar + % */}
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-bold font-mono" style={{ color: lord.color }}>
                      {Math.round((lord.count / totalTerritories) * 100)}%
                    </div>
                    <div className="mt-0.5 h-1 w-10 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: lord.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(lord.count / totalTerritories) * 100}%` }}
                        transition={{ delay: i * 0.05 + 0.15, duration: 0.4, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer stats */}
        <div className="relative z-10 mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
          <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2 text-center">
            <div className="font-mono text-sm font-bold text-mint">{unclaimed}</div>
            <div className="text-[10px] text-mist">Unclaimed</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2 text-center">
            <div className="font-mono text-sm font-bold text-grape">{ownerMap.size}</div>
            <div className="text-[10px] text-mist">Active Lords</div>
          </div>
        </div>

        {/* CTA */}
        <p className="relative z-10 mt-2 text-center text-[10px] text-mist/50 font-mono tracking-widest">
          TAP ANY SECTOR TO BEGIN
        </p>
      </div>
    );
  }

  const biome = BIOMES[t.biome];
  const mine = !!t.owner && t.owner === me;
  const garrison = t.chogId != null ? deriveChog(t.chogId) : null;
  const pending = mine ? Math.floor(pendingYield(t, now)) : 0;
  const canAttackAdjacent = !rival && !mine && !adjacent; // eslint-disable-line @typescript-eslint/no-unused-vars

  // Power notes for garrison / selected chog
  const garrisonNotes = garrison ? powerNotes(garrison) : [];
  const chogNotes = chog ? powerNotes(chog) : [];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={t.id}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="panel flex h-full flex-col gap-4 overflow-y-auto p-4"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between">
            <span className="label">Territory #{String(t.id).padStart(3, '0')}</span>
            <button
              className="text-mist transition hover:text-white"
              onClick={() => useGame.getState().select(null)}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">{t.name}</h2>
          <span className="chip mt-1">{BIOME_ICONS[biome.iconName]} {t.biome}</span>
        </div>

        {/* ── Stats grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Yield/day"
            value={tileYield(t) || Math.round(100 * biome.yield)}
            tone="text-mint"
            icon={<Coins className="h-3 w-3" />}
          />
          <Stat
            label="Defense"
            value={
              t.chogId ? (
                <PowerTooltip notes={garrisonNotes}>
                  <span className="underline decoration-dotted decoration-white/20">
                    {tileDefense(t)}
                  </span>
                </PowerTooltip>
              ) : (
                '—'
              )
            }
            tone="text-ice"
            icon={<Shield className="h-3 w-3" />}
          />
          <Stat
            label="Lord"
            value={
              <span className="font-display text-base" style={{ color: t.owner ? t.ownerColor : '#94A3B8' }}>
                {t.owner ? ownerLabel(t, me) : 'Nobody'}
              </span>
            }
            tone=""
            icon={<MapPin className="h-3 w-3" />}
          />
        </div>

        {/* ── Garrison chog card ───────────────────────────────────────── */}
        {garrison && (
          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
            <ChogAvatar chog={garrison} size={52} />
            <div className="text-sm">
              <div className="label">Garrison</div>
              <div className="font-display font-bold">{garrison.name}</div>
              <div className="font-mono text-xs text-mist">{garrison.rarity} · {powerNotes(garrison)[0]}</div>
              {/* Garrison trait chips */}
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="chip !text-[10px]" style={{ color: FUR_COLOR[garrison.traits.fur] ?? '#fff' }}>
                  ● {garrison.traits.fur}
                </span>
                <span className="chip !text-[10px]">{garrison.traits.hat}</span>
                <span className="chip !text-[10px]">{garrison.traits.eyes} eyes</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Adjacent-territory strategic hint ────────────────────────── */}
        {!mine && !rival && me && (
          <div
            className={`rounded-xl border p-3 text-xs ${
              adjacent
                ? 'border-mint/30 bg-mint/5 text-mint'
                : 'border-white/5 bg-white/[0.02] text-mist'
            }`}
          >
            {adjacent ? (
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3" /> Adjacent to your territory — border expansion!
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Not adjacent to your land. You can still claim it.
              </span>
            )}
          </div>
        )}

        {/* ── Rival tile context ───────────────────────────────────────── */}
        {rival && me && (
          <div className="rounded-xl border border-rose/20 bg-rose/5 p-3 text-xs text-rose/80">
            <span className="flex items-center gap-1.5">
              <Swords className="h-3 w-3" /> Held by {ownerLabel(t, me)}. Attack to seize it.
            </span>
            {adjacentTiles.length > 0 && (
              <span className="mt-1 block text-mist">
                Neighbors:{' '}
                {adjacentTiles
                  .slice(0, 4)
                  .map((nid) => territories[nid])
                  .filter(Boolean)
                  .map((n) => (n.owner === me ? 'You' : n.owner ? n.ownerName : 'Free'))
                  .join(', ')}
              </span>
            )}
            {/* Adjacent-mine count badge */}
            {myAdjacentCount > 0 && (
              <span className="mt-1 flex items-center gap-1 text-mint">
                <Users className="h-3 w-3" />
                {myAdjacentCount} of your tile{myAdjacentCount > 1 ? 's' : ''} border this hex
              </span>
            )}
          </div>
        )}

        {/* ── Action area ─────────────────────────────────────────────── */}
        {!isConnected ? (
          <div className="rounded-xl border border-grape/30 bg-grape/10 p-4 text-center">
            <p className="mb-3 text-sm">You're spectating. Connect a wallet holding a Chog to play.</p>
            <div className="flex justify-center"><ConnectButton /></div>
          </div>
        ) : mine ? (
          /* ── My tile: pending yield ──────────────────────────────── */
          <div className="mt-auto space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="label">Pending yield</span>
              {/* Animated live counter — pulses green when claimable */}
              <motion.span
                className={`font-mono text-2xl font-bold ${pending > 0 ? 'text-mint' : 'text-mist'}`}
                animate={pending > 0 ? { opacity: [1, 0.65, 1] } : { opacity: 1 }}
                transition={{ duration: 1.8, repeat: pending > 0 ? Infinity : 0, ease: 'easeInOut' }}
              >
                <CountUp to={pending} duration={0.6} />
              </motion.span>
            </div>
            {/* Quick harvest CTA */}
            {pending > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 rounded-xl border border-mint/30 bg-mint/5 px-3 py-1.5 text-xs text-mint"
              >
                <Zap className="h-3 w-3 shrink-0" />
                <span>Yield ready to harvest!</span>
              </motion.div>
            )}
            <button
              className="btn-mint w-full"
              disabled={busy || pending < 1}
              onClick={() => run(() => act.harvest([t.id]))}
            >
              {busy ? 'Harvesting…' : 'Claim $CHOG'}
            </button>
          </div>
        ) : chogs.length === 0 ? (
          /* ── No chogs — access gate ─────────────────────────────── */
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 shrink-0">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Access Restricted</div>
                <div className="text-[10px] text-mist">No Chog Genesis NFT detected</div>
              </div>
            </div>
            {/* Compact info */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[10px] text-mist">
                <div className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />
                <span>Wallet has no Chog NFTs on Monad</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-mist">
                <div className="h-1 w-1 rounded-full bg-mint shrink-0" />
                <span>Demo Mode is free — no gas needed</span>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-2">
              <button
                className="btn-mint flex-1 !py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
                onClick={() => { useGame.getState().playGuest(); }}
              >
                <Zap className="w-3.5 h-3.5" />
                Demo Mode
              </button>
              {MINT_URL && (
                <a href={MINT_URL} target="_blank" rel="noreferrer" className="btn-ghost flex-1 !py-2 text-xs flex items-center justify-center gap-1.5 text-mist">
                  <MapPin className="w-3 h-3" />
                  Get NFT
                </a>
              )}
            </div>
          </div>
        ) : (
          /* ── Chog picker + action ─────────────────────────────────── */
          <div className="mt-auto space-y-3">
            <div className="label">{rival ? 'Choose your attacker' : 'Choose a Chog to stake'}</div>

            {/* Picker with smooth entrance animation */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <ChogPicker value={pick} onChange={setPick} />
            </motion.div>

            {/* Selected chog details */}
            <AnimatePresence>
              {chog && (
                <motion.div
                  key={chog.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden space-y-1.5"
                >
                  {/* Trait chips */}
                  <div className="flex flex-wrap gap-1">
                    <span className="chip !text-[10px]" style={{ color: FUR_COLOR[chog.traits.fur] ?? '#fff' }}>
                      ● {chog.traits.fur}
                    </span>
                    <span className="chip !text-[10px]">{chog.traits.hat}</span>
                    <span className="chip !text-[10px]">{chog.traits.eyes} eyes</span>
                  </div>

                  {/* Power breakdown (hover tooltip on ATK/DEF inline) */}
                  <p className="text-xs text-mist">
                    <PowerTooltip notes={chogNotes}>
                      <span className="underline decoration-dotted decoration-white/20">
                        {powerNotes(chog).join(' · ')}
                      </span>
                    </PowerTooltip>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Win-chance bar (rival only) */}
            {rival && odds !== null && (
              <div>
                <div className="mb-1 flex justify-between font-mono text-xs">
                  <span className="flex items-center gap-1 text-mist">
                    <TrendingUp className="h-3 w-3" /> Win chance
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold ${oddsLabel(odds).color}`}>
                      {oddsLabel(odds).text}
                    </span>
                    <span className={odds > 0.5 ? 'text-mint' : 'text-rose'}>
                      {Math.round(odds * 100)}%
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full"
                    style={{ background: 'linear-gradient(90deg,#F43F5E,#FB923C,#34D399)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${odds * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
              </div>
            )}

            {/* CTA button */}
            {rival ? (
              <button
                className="btn-danger w-full"
                disabled={!chog || busy || (DEMO && balance < ATTACK_FEE)}
                onClick={() => run(() => act.attack(t.id, chog!))}
              >
                {busy ? 'Sharpening spikes…' : `Attack · ${ATTACK_FEE} $CHOG`}
              </button>
            ) : (
              <button
                className="btn-primary w-full"
                disabled={!chog || busy}
                onClick={() => run(() => act.claim(t.id, chog!.id))}
              >
                {busy ? 'Planting the flag…' : 'Stake & claim'}
              </button>
            )}

            {rival && DEMO && balance < ATTACK_FEE && (
              <p className="text-center text-xs text-rose">Not enough $CHOG. Go harvest something.</p>
            )}
            {err && <p className="text-center text-xs text-rose">{err}</p>}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
