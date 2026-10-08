'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { BattleView, Chog, HistoryItem, Notice, Territory } from '@/lib/types';
import {
  ATTACK_FEE, COOLDOWN_MS, LORDS, colorForAddress, createWorld, deriveChog, pendingYield, shortAddr, tileDefense,
} from '@/lib/game';

const uid = () => Math.random().toString(36).slice(2, 9);
const log = (h: HistoryItem[], i: Omit<HistoryItem, 'id' | 'ts'>): HistoryItem[] =>
  [{ id: uid(), ts: Date.now(), ...i }, ...h].slice(0, 60);

interface GameState {
  territories: Territory[];
  me: string | null;
  myColor: string;
  chogs: Chog[];
  cooldowns: Record<number, number>;
  balance: number;
  earned: number;
  distributed: number;
  history: HistoryItem[];
  selectedId: number | null;
  hoveredId: number | null;
  drawerOpen: boolean;
  soundOn: boolean;
  battle: BattleView | null;
  notice: Notice | null;
  isGuest: boolean;

  hydrate: (t: Territory[]) => void;
  connect: (address: string) => void;
  playGuest: () => void;
  disconnect: () => void;
  setChogs: (c: Chog[]) => void;
  setBalance: (n: number) => void;
  select: (id: number | null) => void;
  hover: (id: number | null) => void;
  setDrawer: (b: boolean) => void;
  toggleSound: () => void;
  toggleInfo: () => void;
  infoOpen: boolean;
  claimTile: (tileId: number, chogId: number) => void;
  startBattle: (b: BattleView) => void;
  commitBattle: () => void;
  closeBattle: () => void;
  harvest: (ids: number[], now: number) => number;
  simulateRaid: () => void;
}

export const useGame = create<GameState>((set, get) => ({
  territories: createWorld(0),
  me: null,
  myColor: '#A855F7',
  chogs: [],
  cooldowns: {},
  balance: 250,
  earned: 0,
  distributed: 1_284_500,
  history: [],
  selectedId: null,
  hoveredId: null,
  drawerOpen: false,
  soundOn: true,
  infoOpen: false,
  battle: null,
  notice: null,
  isGuest: false,

  hydrate: (territories) => set({ territories }),

  connect: (address) => set({ me: address.toLowerCase(), myColor: colorForAddress(address), isGuest: false }),
  playGuest: () => {
    const address = '0x133700000000000000000000000000000000beef';
    set({ me: address, myColor: colorForAddress(address), isGuest: true });
  },
  disconnect: () => set({ me: null, chogs: [], selectedId: null, isGuest: false }),

  setChogs: (chogs) => {
    const { territories, me } = get();
    set({ chogs: chogs.filter((c) => !territories.some((t) => t.owner === me && t.chogId === c.id)) });
  },
  setBalance: (balance) => set({ balance }),
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
  setDrawer: (drawerOpen) => set({ drawerOpen }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  toggleInfo: () => set((s) => ({ infoOpen: !s.infoOpen })),

  claimTile: (tileId, chogId) => {
    const s = get();
    const tile = s.territories[tileId];
    const now = Date.now();
    set({
      territories: s.territories.map((t) =>
        t.id === tileId
          ? { ...t, owner: s.me, ownerName: shortAddr(s.me!), ownerColor: s.myColor, chogId, lastClaim: now }
          : t,
      ),
      chogs: s.chogs.filter((c) => c.id !== chogId),
      history: log(s.history, { kind: 'claim', text: `Secured ${tile.name}` }),
    });
    
    // Sync to Supabase
    supabase.from('territories').upsert({
      id: tileId,
      owner: s.me,
      chog_id: chogId,
      last_claim: new Date(now).toISOString()
    }).then();
  },

  startBattle: (battle) => set((s) => ({ battle, balance: Math.max(0, s.balance - ATTACK_FEE) })),

  commitBattle: () => {
    const s = get();
    const b = s.battle;
    if (!b || b.committed) return;
    const tile = s.territories[b.tileId];
    const now = Date.now();
    
    if (b.result.won) {
      set({
        battle: { ...b, committed: true },
        territories: s.territories.map((t) =>
          t.id === tile.id
            ? { ...t, owner: s.me, ownerName: shortAddr(s.me!), ownerColor: s.myColor, chogId: b.chog.id, lastClaim: now }
            : t,
        ),
        chogs: s.chogs.filter((c) => c.id !== b.chog.id),
        history: log(s.history, { kind: 'attack', won: true, text: `Conquered ${tile.name}` }),
      });
      
      supabase.from('territories').upsert({
        id: tile.id,
        owner: s.me,
        chog_id: b.chog.id,
        last_claim: new Date(now).toISOString()
      }).then();
    } else {
      set({
        battle: { ...b, committed: true },
        cooldowns: { ...s.cooldowns, [b.chog.id]: now + COOLDOWN_MS },
        history: log(s.history, { kind: 'attack', won: false, text: `Repelled at ${tile.name}` }),
      });
    }
    
    // Log the battle
    supabase.from('battles').insert({
      tile_id: tile.id,
      attacker: s.me,
      defender: tile.owner,
      attacker_won: b.result.won,
      attack_roll: b.result.atkRoll,
      defense_roll: b.result.defRoll
    }).then();
  },
  closeBattle: () => set({ battle: null }),

  harvest: (ids, now) => {
    const s = get();
    let total = 0;
    const territories = s.territories.map((t) => {
      if (!ids.includes(t.id) || t.owner !== s.me) return t;
      total += pendingYield(t, now);
      return { ...t, lastClaim: now };
    });
    total = Math.floor(total);
    set({
      territories,
      balance: s.balance + total,
      earned: s.earned + total,
      distributed: s.distributed + total,
      history: log(s.history, { kind: 'harvest', text: `Yielded ${total} $CHOG`, amount: total }),
    });
    return total;
  },

  simulateRaid: () => {
    const s = get();
    const mine = s.territories.filter((t) => t.owner && t.owner === s.me);
    if (!mine.length) return;
    const t = mine[Math.floor(Math.random() * mine.length)];
    const lord = LORDS[Math.floor(Math.random() * LORDS.length)];
    const atk = Math.round((45 + Math.random() * 60) * (0.7 + Math.random() * 0.6));
    const def = Math.round(tileDefense(t) * (0.7 + Math.random() * 0.6));

    if (atk > def) {
      const owed = Math.floor(pendingYield(t, Date.now()));
      set({
        territories: s.territories.map((x) =>
          x.id === t.id ? { ...x, owner: lord.addr, ownerName: lord.name, ownerColor: lord.color, chogId: 1000 + t.id, lastClaim: Date.now() } : x,
        ),
        chogs: [...s.chogs, deriveChog(t.chogId!)],
        balance: s.balance + owed,
        earned: s.earned + owed,
        notice: { id: uid(), tone: 'bad', text: `Hex lost! ${lord.name} seized ${t.name}.` },
        history: log(s.history, { kind: 'raid', text: `Lost ${t.name}` }),
      });
    } else {
      set({
        notice: { id: uid(), tone: 'good', text: `Raid repelled! ${t.name} held off ${lord.name}.` },
        history: log(s.history, { kind: 'defend', text: `Defended ${t.name}` }),
      });
    }
  },
}));
