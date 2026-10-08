import { DEMO } from './contracts';
import type { BattleResult, Biome, Chog, Rarity, Territory } from './types';

export const COLS = 14;
export const ROWS = 10;
export const BASE_YIELD = 100;
export const ATTACK_FEE = 25;
export const COOLDOWN_MS = 60_000;
const DAY_MS = 86_400_000;
export const TIME_SCALE = DEMO ? 288 : 1;

export const hexToNum = (c: string) => Number('0x' + c.replace('#', ''));
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const BIOMES: Record<Biome, { fill: string; yield: number; def: number; iconName: string }> = {
  'Mushroom Grove': { fill: '#2b1a52', yield: 1.0, def: 1.1, iconName: 'TreePine' },
  'Crystal Fields': { fill: '#0e3c4a', yield: 1.2, def: 1.0, iconName: 'Gem' },
  'Ember Flats': { fill: '#4a2412', yield: 1.4, def: 0.9, iconName: 'Flame' },
  'Moss Hollow': { fill: '#12382a', yield: 1.0, def: 1.2, iconName: 'Leaf' },
  'Void Dunes': { fill: '#1b2038', yield: 1.6, def: 0.8, iconName: 'Wind' },
};
const BIOME_KEYS = Object.keys(BIOMES) as Biome[];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RARITY_MULT: Record<Rarity, number> = { Common: 1, Uncommon: 1.15, Rare: 1.35, Epic: 1.65, Legendary: 2.1 };
export const RARITY_COLOR: Record<Rarity, string> = {
  Common: '#94A3B8', Uncommon: '#34D399', Rare: '#22D3EE', Epic: '#A855F7', Legendary: '#FB923C',
};
export const FUR_COLOR: Record<string, string> = {
  Moss: '#4ade80', Ember: '#fb923c', Frost: '#67e8f9', Violet: '#c084fc', Honey: '#fbbf24', Midnight: '#6366f1',
};
const HATS = ['Bucket Hat', 'Crown', 'Wizard Hat', 'Party Cone', 'Bare Spikes', 'Halo'];
const EYES = ['Curious', 'Chaotic', 'Sleepy', 'Starry', 'Smug'];
const BGS = ['Mushroom', 'Crystal', 'Ember', 'Void', 'Meadow'];

const chogCache = new Map<number, Chog>();
const realTraitsCache = new Map<number, any>();

// In-browser global store update helper
function updateChogMeta(id: number, data: any) {
  realTraitsCache.set(id, data);
  chogCache.delete(id); // Force rebuild
}

export function deriveChog(id: number): Chog {
  const hit = chogCache.get(id);
  if (hit) return hit;

  const real = realTraitsCache.get(id);
  const r = rng(id * 9973 + 17);
  const roll = r();
  
  let rarity: Rarity;
  let traits: { fur: string, hat: string, eyes: string, background: string };

  if (real) {
    rarity = (real.Tier || 'Common') as Rarity;
    // We try to match our generic trait model to the real Chog attributes
    traits = {
      fur: real.Skin || real.Body || 'Origin',
      hat: real.Head || real.Accessory || 'None',
      eyes: real.Eyes || 'Normal',
      background: real.Background || 'Clear'
    };
  } else {
    rarity = roll < 0.5 ? 'Common' : roll < 0.78 ? 'Uncommon' : roll < 0.92 ? 'Rare' : roll < 0.985 ? 'Epic' : 'Legendary';
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    traits = { fur: pick(Object.keys(FUR_COLOR)), hat: pick(HATS), eyes: pick(EYES), background: pick(BGS) };
  }

  const m = RARITY_MULT[rarity] || 1;
  const chog: Chog = {
    id,
    name: `Chog #${id}`,
    rarity,
    traits,
    attack: Math.round(40 * m + (traits.eyes === 'Chaotic' ? 8 : 0) + (traits.hat === 'Wizard Hat' ? 6 : 0) + r() * 10),
    defense: Math.round(40 * m + (traits.eyes === 'Sleepy' ? 8 : 0) + (traits.hat === 'Halo' ? 6 : 0) + r() * 10),
    yieldBoost: +((m - 1) * 0.25 + (traits.hat === 'Crown' ? 0.1 : 0)).toFixed(2),
  };
  chogCache.set(id, chog);
  return chog;
}

// Manually triggered to prevent network spam
export async function fetchChogMeta(id: number) {
  if (realTraitsCache.has(id)) return;
  if (id < 1 || id > 1969) return;
  try {
    const res = await fetch(`/api/chog/${id}/meta`);
    const data = await res.json();
    if (data && data.Tier) {
      updateChogMeta(id, data);
      window.dispatchEvent(new CustomEvent('chog-meta-loaded', { detail: id }));
    }
  } catch (err) {
    // Ignore fetch errors
  }
}

export function powerNotes(c: Chog): string[] {
  const notes = [`${c.rarity} rarity ×${RARITY_MULT[c.rarity]} base power`];
  if (c.traits.eyes === 'Chaotic') notes.push('Chaotic eyes: +8 ATK');
  if (c.traits.eyes === 'Sleepy') notes.push('Sleepy eyes: +8 DEF');
  if (c.traits.hat === 'Wizard Hat') notes.push('Wizard Hat: +6 ATK');
  if (c.traits.hat === 'Halo') notes.push('Halo: +6 DEF');
  if (c.traits.hat === 'Crown') notes.push('Crown: +10% yield');
  return notes;
}

export const LORDS = [
  { addr: '0x71c0000000000000000000000000000000a1f3', name: 'SpikeLord', color: '#F43F5E' },
  { addr: '0x9ab1000000000000000000000000000000c4d2', name: 'NadNinja', color: '#22D3EE' },
  { addr: '0x3de2000000000000000000000000000000b7e9', name: 'QuillQueen', color: '#FB923C' },
  { addr: '0x58f3000000000000000000000000000000d1a0', name: 'MossMonk', color: '#34D399' },
  { addr: '0xc2a4000000000000000000000000000000e8b5', name: 'ChaosGoblin', color: '#FACC15' },
  { addr: '0x14b5000000000000000000000000000000f2c6', name: 'VoidWalker', color: '#818CF8' },
  { addr: '0xe7d6000000000000000000000000000000a9d7', name: 'FuzzBaron', color: '#F472B6' },
  { addr: '0x20c7000000000000000000000000000000b3e8', name: 'ZapZapZap', color: '#2DD4BF' },
];
const PLAYER_COLORS = ['#A855F7', '#22D3EE', '#FB923C', '#34D399', '#F43F5E', '#FACC15'];
export const colorForAddress = (a: string) => PLAYER_COLORS[parseInt(a.slice(2, 8), 16) % PLAYER_COLORS.length];
export const ownerLabel = (t: Territory, me: string | null) => (t.owner && t.owner === me ? 'You' : t.ownerName);

const PREFIX = ['Spike', 'Moss', 'Glim', 'Nad', 'Fuzz', 'Quill', 'Mon', 'Zap', 'Burr', 'Chaos', 'Snuffle', 'Thorn'];
const SUFFIX = ['Hollow', 'Reach', 'Crater', 'Garden', 'Pit', 'Ridge', 'Nook', 'Spire', 'Bog', 'Heights', 'Fields', 'Den'];
const hash2 = (a: number, b: number) => ((a * 73856093) ^ (b * 19349663)) >>> 0;

export function createWorld(now: number): Territory[] {
  const r = rng(2026);
  const out: Territory[] = [];

  // Lords clustered geographically — territories look like kingdoms at war
  const lordCluster = (q: number, row: number) => LORDS[(Math.floor(q / 4) + Math.floor(row / 3) * 4) % LORDS.length];

  for (let row = 0; row < ROWS; row++) {
    for (let q = 0; q < COLS; q++) {
      const id = row * COLS + q;
      const cluster = BIOME_KEYS[hash2(Math.floor(q / 3), Math.floor(row / 3)) % BIOME_KEYS.length];
      const biome = r() < 0.2 ? BIOME_KEYS[Math.floor(r() * BIOME_KEYS.length)] : cluster;
      const name = `${PREFIX[Math.floor(r() * PREFIX.length)]} ${SUFFIX[Math.floor(r() * SUFFIX.length)]}`;
      // 65% tiles claimed — map looks active & contested
      const owned = r() < 0.65;
      // 20% chance a rival lord "invaded" a neighboring sector
      const lord = r() < 0.2 ? LORDS[Math.floor(r() * LORDS.length)] : lordCluster(q, row);
      
      // Use a smaller pool of unique Chog IDs (15 total) so images load instantly from cache
      // and we don't hit IPFS rate limits when rendering a full map of 100+ hexes.
      const pool = [78, 1277, 855, 420, 69, 1337, 888, 777, 999, 111, 333, 555, 1234, 1969, 42];
      const chogId = owned ? pool[id % pool.length] : null;
      
      const age = Math.floor(r() * 6 * 60_000);
      out.push({
        id, q, r: row, name, biome,
        owner: owned ? lord.addr : null,
        ownerName: owned ? lord.name : '',
        ownerColor: owned ? lord.color : '#ffffff',
        chogId,
        lastClaim: now - age,
      });
    }
  }
  return out;
}

export const tileDefense = (t: Territory) =>
  t.chogId == null ? 0 : Math.round(deriveChog(t.chogId).defense * BIOMES[t.biome].def);

export const tileYield = (t: Territory) =>
  Math.round(BASE_YIELD * BIOMES[t.biome].yield * (1 + (t.chogId != null ? deriveChog(t.chogId).yieldBoost : 0)));

export function pendingYield(t: Territory, now: number) {
  if (!t.owner || t.chogId == null) return 0;
  const days = (Math.max(0, now - t.lastClaim) / DAY_MS) * TIME_SCALE;
  return tileYield(t) * days;
}

export function simulate(att: Chog, t: Territory): BattleResult {
  const atkPower = att.attack;
  const defPower = tileDefense(t);
  const c = Math.random();
  const chaos = c < 0.06 ? 'attacker' : c < 0.12 ? 'defender' : null;
  const atkRoll = Math.round(atkPower * (0.7 + Math.random() * 0.6) * (chaos === 'attacker' ? 1.5 : 1));
  const defRoll = Math.round(defPower * (0.7 + Math.random() * 0.6) * (chaos === 'defender' ? 1.5 : 1));
  return { atkPower, defPower, atkRoll, defRoll, won: atkRoll > defRoll, chaos };
}

export function winChance(att: Chog, t: Territory, n = 400) {
  let w = 0;
  for (let i = 0; i < n; i++) if (simulate(att, t).won) w++;
  return w / n;
}

export function demoChogIds(address: string) {
  const r = rng(parseInt(address.slice(2, 10), 16) || 1);
  return Array.from({ length: 6 }, () => 1 + Math.floor(r() * 1968));
}

/** Find adjacent tiles (hex neighbors for odd-r offset). */
export function neighbors(tileId: number, territories: Territory[]): number[] {
  const t = territories[tileId];
  if (!t) return [];
  const odd = (t.r & 1) === 1;
  const offsets = odd
    ? [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]]
    : [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
  return offsets
    .map(([dq, dr]) => {
      const nq = t.q + dq;
      const nr = t.r + dr;
      if (nq < 0 || nq >= COLS || nr < 0 || nr >= ROWS) return -1;
      return nr * COLS + nq;
    })
    .filter((id) => id >= 0 && territories[id]);
}

/** Is this tile adjacent to one of my territories? */
export function isAdjacentToMine(tileId: number, territories: Territory[], me: string | null): boolean {
  if (!me) return false;
  return neighbors(tileId, territories).some((nid) => territories[nid].owner === me);
}
