'use client';

import type { Chog } from '@/lib/types';
import { RARITY_COLOR } from '@/lib/game';
import { useGame } from '@/store/useGame';
import { useNow } from '@/lib/hooks';
import { ChogAvatar } from './ChogAvatar';

interface Props {
  chog: Chog;
  status?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function ChogCard({ chog, status, selected, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? 'border-ice/80 bg-ice/10 shadow-[0_0_24px_-6px_#22D3EE]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
      }`}
    >
      <ChogAvatar chog={chog} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display font-bold">{chog.name}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: RARITY_COLOR[chog.rarity] }}>
            {chog.rarity}
          </span>
        </div>
        <div className="mt-0.5 flex gap-3 font-mono text-xs">
          <span className="text-rose">ATK {chog.attack}</span>
          <span className="text-ice">DEF {chog.defense}</span>
          <span className="text-mint">+{Math.round(chog.yieldBoost * 100)}%</span>
        </div>
        {status && <div className="mt-0.5 text-[11px] text-coral">{status}</div>}
      </div>
    </button>
  );
}

export function ChogPicker({ value, onChange }: { value: number | null; onChange: (id: number) => void }) {
  const chogs = useGame((s) => s.chogs);
  const cooldowns = useGame((s) => s.cooldowns);
  const now = useNow();

  return (
    <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
      {chogs.map((c) => {
        const left = Math.max(0, Math.ceil(((cooldowns[c.id] ?? 0) - now) / 1000));
        return (
          <ChogCard
            key={c.id}
            chog={c}
            selected={value === c.id}
            disabled={left > 0}
            status={left > 0 ? `Resting… ${left}s` : undefined}
            onClick={() => onChange(c.id)}
          />
        );
      })}
    </div>
  );
}
