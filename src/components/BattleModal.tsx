'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/store/useGame';
import { burst, sfx } from '@/lib/fx';
import { ChogAvatar } from './ChogAvatar';
import { CountUp } from './CountUp';

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-xs">
        <span className="text-slate-400">{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function BattleModal() {
  const battle = useGame((s) => s.battle);
  const [stage, setStage] = useState(0);
  const [copied, setCopied] = useState(false);
  const key = battle ? `${battle.tileId}-${battle.chog.id}` : null;

  useEffect(() => {
    if (!key) return;
    const b = useGame.getState().battle!;
    setStage(0);
    setCopied(false);
    const t1 = setTimeout(() => { setStage(1); sfx.clash(); }, 900);
    const t2 = setTimeout(() => {
      setStage(2);
      useGame.getState().commitBattle();
      burst(b.result.won ? 'win' : 'lose');
      b.result.won ? sfx.win() : sfx.lose();
    }, 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [key]);

  // Escape key to close after battle
  useEffect(() => {
    if (stage < 2) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useGame.getState().closeBattle();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stage]);

  const tile = useGame((s) => (battle ? s.territories[battle.tileId] : null));
  if (!battle || !tile) return null;
  const { result, chog, defChog } = battle;

  const maxPower = Math.max(result.atkPower, result.defPower);
  const maxRoll = Math.max(result.atkRoll, result.defRoll);

  function shareResult() {
    const msg = result.won
      ? `⚔️ I seized ${tile!.name} with ${chog.name}! (${result.atkRoll} vs ${result.defRoll}) — Territory game`
      : `🛡️ Repelled at ${tile!.name}. ${chog.name} sulks. (${result.atkRoll} vs ${result.defRoll}) — Territory game`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Stage 0: pre-battle preview
  const stage0Text = `${chog.name} charges at ${tile.name}!`;
  const stage1Text = `Rolling dice…`;
  const stage2Text = result.won
    ? `${defChog.name} released. ${chog.name} now rules ${tile.name}.`
    : `${chog.name} retreats to sulk for a minute. The fee is gone.`;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className={`panel w-full max-w-xl overflow-hidden p-6 text-center transition-colors duration-700 ${
            stage === 2
              ? result.won
                ? 'border-[#34D399]/30 bg-[#34D399]/5'
                : 'border-rose-500/30 bg-rose-500/5'
              : ''
          }`}
          animate={result.chaos && stage >= 1 ? { x: [0, -4, 4, -3, 3, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {/* Progress bar */}
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-[#A855F7] via-[#FB923C] to-[#34D399]"
              animate={{ width: stage === 0 ? '20%' : stage === 1 ? '65%' : '100%' }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          <div className="label">Battle for</div>
          <h2 className="font-display text-3xl font-bold">{tile.name}</h2>

          {/* Narrative text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-2 text-sm text-slate-400"
            >
              {stage === 0 ? stage0Text : stage === 1 ? stage1Text : stage2Text}
            </motion.p>
          </AnimatePresence>

          {result.chaos && stage >= 1 && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto mt-3 w-fit rounded-full border border-[#FB923C]/60 bg-[#FB923C]/15 px-3 py-1 font-mono text-xs text-[#FB923C]"
            >
              🌀 CHAOS SURGE — {result.chaos === 'attacker' ? chog.name : defChog.name} rolls ×1.5
            </motion.div>
          )}

          {/* Pre-battle stats comparison (stage 0) */}
          {stage === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-4 max-w-xs space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <StatBar label={`${chog.name} ATK`} value={result.atkPower} max={maxPower} color="#F43F5E" />
              <StatBar label={`${defChog.name} DEF`} value={result.defPower} max={maxPower} color="#22D3EE" />
              <div className="pt-1 text-center font-mono text-[10px] text-slate-500">
                Estimated win chance: {Math.round((result.atkPower / (result.atkPower + result.defPower)) * 100)}%
              </div>
            </motion.div>
          )}

          {/* Battle arena */}
          <div className="relative my-8 flex items-center justify-between px-2 sm:px-8">
            <motion.div
              initial={{ x: -120, opacity: 0 }}
              animate={
                stage === 1
                  ? { x: [0, 60, 40], rotate: [0, 8, 0] }
                  : stage === 2 && !result.won
                  ? { x: -20, opacity: 0.5, rotate: -12 }
                  : { x: 0, opacity: 1 }
              }
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            >
              <ChogAvatar chog={chog} size={104} />
              <div className="label mt-2 text-[#22d3ee]">You</div>
              <div className="font-mono text-4xl font-bold text-rose-400">
                <CountUp to={stage >= 1 ? result.atkRoll : 0} duration={1.5} />
              </div>
              {stage >= 1 && (
                <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                  ATK {result.atkPower}
                  {result.chaos === 'attacker' && <span className="ml-1 text-[#FB923C]">×1.5</span>}
                </div>
              )}
              {stage >= 1 && <StatBar label="" value={result.atkRoll} max={maxRoll} color="#F43F5E" />}
            </motion.div>

            <motion.div
              className="text-4xl"
              animate={stage === 1 ? { scale: [1, 1.8, 1], rotate: [0, 20, -20, 0] } : {}}
              transition={{ duration: 0.6, repeat: stage === 1 ? 3 : 0 }}
            >
              ⚔
            </motion.div>

            <motion.div
              initial={{ x: 120, opacity: 0 }}
              animate={
                stage === 1
                  ? { x: [0, -60, -40], rotate: [0, -8, 0] }
                  : stage === 2 && result.won
                  ? { x: 20, opacity: 0.5, rotate: 12 }
                  : { x: 0, opacity: 1 }
              }
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
            >
              <ChogAvatar chog={defChog} size={104} />
              <div className="label mt-2" style={{ color: tile.ownerColor }}>{tile.ownerName}</div>
              <div className="font-mono text-4xl font-bold text-[#22d3ee]">
                <CountUp to={stage >= 1 ? result.defRoll : 0} duration={1.5} />
              </div>
              {stage >= 1 && (
                <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                  DEF {result.defPower}
                  {result.chaos === 'defender' && <span className="ml-1 text-[#FB923C]">×1.5</span>}
                </div>
              )}
              {stage >= 1 && <StatBar label="" value={result.defRoll} max={maxRoll} color="#22D3EE" />}
            </motion.div>
          </div>

          <div className="h-28">
            {stage === 2 && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16 }}
                className="space-y-2"
              >
                <div className={`font-display text-3xl font-bold ${result.won ? 'text-[#34D399]' : 'text-rose-400'}`}>
                  {result.won ? '🏆 TERRITORY SEIZED' : '💨 REPELLED'}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button className="btn-primary" onClick={() => useGame.getState().closeBattle()}>
                    Back to the map
                  </button>
                  <button
                    className="btn-ghost !px-3 !py-2 text-sm"
                    onClick={shareResult}
                  >
                    {copied ? '✅ Copied!' : '📋 Share'}
                  </button>
                </div>
                <p className="text-xs text-slate-500">Press Esc to close</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
