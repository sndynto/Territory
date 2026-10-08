export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type Biome = 'Mushroom Grove' | 'Crystal Fields' | 'Ember Flats' | 'Moss Hollow' | 'Void Dunes';

export interface Chog {
  id: number;
  name: string;
  rarity: Rarity;
  traits: { fur: string; hat: string; eyes: string; background: string };
  attack: number;
  defense: number;
  yieldBoost: number;
}

export interface Territory {
  id: number;
  q: number;
  r: number;
  name: string;
  biome: Biome;
  owner: string | null;
  ownerName: string;
  ownerColor: string;
  chogId: number | null;
  lastClaim: number;
}

export interface BattleResult {
  atkPower: number;
  defPower: number;
  atkRoll: number;
  defRoll: number;
  won: boolean;
  chaos: 'attacker' | 'defender' | null;
}

export interface BattleView {
  tileId: number;
  chog: Chog;
  defChog: Chog;
  result: BattleResult;
  committed: boolean;
}

export interface HistoryItem {
  id: string;
  ts: number;
  kind: 'claim' | 'attack' | 'defend' | 'harvest' | 'raid';
  text: string;
  amount?: number;
  won?: boolean;
}

export interface Notice {
  id: string;
  text: string;
  tone: 'good' | 'bad' | 'chaos';
}
