import confetti from 'canvas-confetti';
import { useGame } from '@/store/useGame';

const COLORS = ['#A855F7', '#22D3EE', '#FB923C', '#34D399', '#F43F5E'];

export function burst(kind: 'claim' | 'win' | 'lose' | 'yield') {
  if (kind === 'lose') {
    confetti({ particleCount: 40, spread: 70, startVelocity: 20, gravity: 1.4, scalar: 0.8, colors: ['#F43F5E', '#FB923C'], origin: { y: 0.6 } });
    return;
  }
  if (kind === 'yield') {
    confetti({ particleCount: 50, spread: 60, shapes: ['circle'], colors: ['#34D399', '#22D3EE'], origin: { y: 0.7 } });
    return;
  }
  const fire = (ratio: number, o: confetti.Options) =>
    confetti({ origin: { y: 0.65 }, colors: COLORS, ...o, particleCount: Math.floor(160 * ratio) });
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.2, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
}

let ctx: AudioContext | null = null;

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.05, slideTo = 0, delay = 0) {
  if (typeof window === 'undefined' || !useGame.getState().soundOn) return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx ??= new AC();
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur);
}

export const sfx = {
  tick: () => tone(660, 0.06, 'triangle', 0.03),
  claim: () => { tone(392, 0.12, 'triangle'); tone(523, 0.12, 'triangle', 0.05, 0, 0.1); tone(784, 0.28, 'triangle', 0.05, 0, 0.2); },
  clash: () => tone(140, 0.3, 'square', 0.05, 50),
  win: () => { tone(523, 0.1, 'square', 0.04); tone(659, 0.1, 'square', 0.04, 0, 0.1); tone(1047, 0.35, 'square', 0.04, 0, 0.2); },
  lose: () => tone(300, 0.5, 'sawtooth', 0.04, 70),
  yield: () => { tone(880, 0.08, 'sine', 0.04); tone(1320, 0.18, 'sine', 0.04, 0, 0.07); },
};
