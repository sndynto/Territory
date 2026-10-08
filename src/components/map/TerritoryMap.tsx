'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Application, Assets, Container, Graphics, Polygon, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { useGame } from '@/store/useGame';
import { TreePine, Gem, Flame, Leaf, Wind, Map as MapIcon } from 'lucide-react';

const BIOME_ICONS: Record<string, React.ReactNode> = {
  TreePine: <TreePine className="w-3 h-3 inline-block" />,
  Gem: <Gem className="w-3 h-3 inline-block" />,
  Flame: <Flame className="w-3 h-3 inline-block text-rose-400" />,
  Leaf: <Leaf className="w-3 h-3 inline-block text-mint" />,
  Wind: <Wind className="w-3 h-3 inline-block text-ice" />
};
import { BIOMES, COLS, ROWS, hexToNum, neighbors, ownerLabel, tileDefense, tileYield } from '@/lib/game';
import { sfx } from '@/lib/fx';

const S = 34;
const HEX_W = Math.sqrt(3) * S;
const MAP_W = HEX_W * (COLS + 0.5);
const MAP_H = S * 1.5 * (ROWS - 1) + S * 2;
const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [Math.cos(a) * (S - 1.5), Math.sin(a) * (S - 1.5)];
}).flat();
const hexPos = (q: number, r: number) => ({ x: HEX_W * (q + (r & 1 ? 0.5 : 0)) + HEX_W / 2, y: S + S * 1.5 * r });

// Texture cache: chogId → Pixi Texture
const textureCache = new Map<number, Texture>();

// Real Chog Genesis IPFS image CID — images are {tokenId}.webp (1–1969)
const CHOG_IMG_CID = 'bafybeihau2egcccbdxymeckmmbrqytbfor5gkt3en6d5fsbueymdbq7g6e';
const IPFS_GATEWAYS = [
  `https://gateway.pinata.cloud/ipfs/${CHOG_IMG_CID}`,
  `https://dweb.link/ipfs/${CHOG_IMG_CID}`,
  `https://ipfs.io/ipfs/${CHOG_IMG_CID}`,
];

export function chogImageUrl(tokenId: number, gateway = 0): string {
  const id = Math.max(1, Math.min(1969, tokenId));
  return `${IPFS_GATEWAYS[gateway % IPFS_GATEWAYS.length]}/${id}.webp`;
}

// Concurrency queue to prevent IPFS rate limits
let activeLoads = 0;
const loadQueue: (() => void)[] = [];
async function processQueue() {
  if (activeLoads >= 15 || loadQueue.length === 0) return;
  activeLoads++;
  const task = loadQueue.shift();
  if (task) task();
}

// Pending loads to prevent duplicate fetching
const loadingPromises = new Map<number, Promise<Texture>>();

/** Load real Chog Genesis image as Pixi Texture — proxy first, then IPFS fallbacks */
async function loadChogTexture(chogId: number): Promise<Texture> {
  const id = Math.max(1, Math.min(1969, chogId));
  if (textureCache.has(id)) return textureCache.get(id)!;
  if (loadingPromises.has(id)) return loadingPromises.get(id)!;
  
  const promise = (async () => {
    // Wait in queue
    await new Promise<void>((resolve) => {
      loadQueue.push(resolve);
      processQueue();
    });

    const proxyAlias = `chog_proxy_${id}`;
    const allSources = [
      { alias: proxyAlias, src: `/api/chog/${id}/image.webp` },
      ...IPFS_GATEWAYS.map((gw, i) => ({ alias: `chog_${id}_${i}`, src: `${gw}/${id}.webp` })),
    ];

    for (const { alias, src } of allSources) {
      try {
        if (!Assets.cache.has(alias)) {
          Assets.add({ alias, src, data: { crossOrigin: 'anonymous' } });
        }
        const tex = await Assets.load<Texture>(alias);
        if (tex && tex !== Texture.WHITE) {
          textureCache.set(id, tex);
          activeLoads--;
          processQueue();
          return tex;
        }
      } catch (err) {
        // try next source
      }
    }
    
    activeLoads--;
    processQueue();
    return Texture.WHITE;
  })();

  loadingPromises.set(id, promise);
  const result = await promise;
  loadingPromises.delete(id);
  return result;
}

interface HexView {
  root: Container;
  base: Graphics;
  glow: Graphics;
  ring: Graphics;
  icon: Graphics;
  sprite: Sprite | null;
  burst: Graphics;
  highlight: Graphics;
  /** Pulsing ring for attack (red) or claim (green) on selected tile */
  actionRing: Graphics;
  /** Text label for territory name */
  label: Text;
  phase: number;
  target: number;
  owned: boolean;
  flash: number;
  color: number;
  isNeighbor: boolean;
  /** Is this a rival (enemy) tile that can be attacked */
  isRival: boolean;
  /** Is this neighbor unclaimed and claimable */
  isClaimable: boolean;
  /** Is this the selected tile */
  isSelected: boolean;
}

export function TerritoryMap({ interactive = true }: { interactive?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const api = useRef({ zoom: (_f: number) => {}, reset: () => {}, focus: (_id: number) => {} });
  const [ready, setReady] = useState(false);
  const interactiveRef = useRef(interactive);
  useEffect(() => { interactiveRef.current = interactive; }, [interactive]);
  const [zoomPct, setZoomPct] = useState(100);
  const me = useGame((s) => s.me);
  const hovered = useGame((s) => (s.hoveredId === null ? null : s.territories[s.hoveredId]));
  const selectedId = useGame((s) => s.selectedId);
  const territories = useGame((s) => s.territories);

  const applyTip = () => { if (tip.current) tip.current.style.transform = `translate(${pos.current.x + 16}px, ${pos.current.y + 16}px)`; };
  useLayoutEffect(applyTip, [hovered?.id]);

  // ─── Minimap: drawn on a 2D canvas, updates whenever territories change ────
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const scaleX = W / MAP_W;
    const scaleY = H / MAP_H;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, W, H);

    territories.forEach((t) => {
      const { x, y } = hexPos(t.q, t.r);
      const mx = x * scaleX;
      const my = y * scaleY;
      const rs = (S - 2) * Math.min(scaleX, scaleY);

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        const px = mx + Math.cos(a) * rs;
        const py = my + Math.sin(a) * rs;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();

      const biomeFill = BIOMES[t.biome].fill;
      ctx.fillStyle = biomeFill;
      ctx.fill();

      if (t.owner) {
        ctx.fillStyle = t.ownerColor + '55';
        ctx.fill();
        ctx.strokeStyle = t.ownerColor;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#2a3350';
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }
    });
  }, [territories]);

  useEffect(() => {
    const el = host.current!;
    const app = new Application();
    let disposed = false;
    let initDone = false;
    let teardown = () => {};

    (async () => {
      await app.init({
        resizeTo: el, backgroundAlpha: 0, antialias: true, autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (disposed) { app.destroy(true, { children: true }); return; }
      initDone = true;
      el.appendChild(app.canvas);

      const fx = new Container();
      const world = new Container();
      app.stage.addChild(fx, world);
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      const drag = { active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 };

      const views: HexView[] = [];
      useGame.getState().territories.forEach((t) => {
        const root = new Container();
        const { x, y } = hexPos(t.q, t.r);
        root.position.set(x, y);

        const base = new Graphics();
        const glow = new Graphics();
        const ring = new Graphics();
        const icon = new Graphics();
        const burst = new Graphics();
        const highlight = new Graphics();
        const actionRing = new Graphics();

        // Chog image sprite (circular mask)
        const sprite = new Sprite();
        sprite.anchor.set(0.5);
        sprite.width = S * 1.1;
        sprite.height = S * 1.1;
        sprite.visible = false;
        // Circular mask for the sprite
        const mask = new Graphics();
        mask.circle(0, 0, S * 0.52).fill({ color: 0xffffff });
        sprite.mask = mask;
        root.addChild(mask);

        // Idle ring (cyan)
        ring.circle(0, 0, 5).stroke({ width: 1.5, color: 0x22d3ee });

        // Burst flash on ownership change
        burst.circle(0, 0, S * 0.9).stroke({ width: 3, color: 0xffffff });
        burst.alpha = 0;

        // Hover highlight fill
        highlight.poly(HEX).fill({ color: 0x22d3ee, alpha: 0 });

        // Territory name label (shown when zoomed in)
        const labelStyle = new TextStyle({
          fontFamily: 'var(--font-body), "Chakra Petch", sans-serif',
          fontSize: 8,
          fill: 0xffffff,
          align: 'center',
          dropShadow: { color: 0x000000, blur: 3, distance: 0, alpha: 0.8 },
        });
        const label = new Text({ text: '', style: labelStyle });
        label.anchor.set(0.5, 0.5);
        label.y = 14;
        label.alpha = 0;

        root.addChild(highlight, glow, base, ring, icon, sprite, actionRing, burst, label);

        const v: HexView = {
          root, base, glow, ring, icon, sprite, burst, highlight, actionRing, label,
          phase: Math.random() * 6.28, target: 1, owned: false, flash: 0,
          color: 0xffffff, isNeighbor: false, isRival: false, isClaimable: false, isSelected: false,
        };

        // Always bind, guard with interactiveRef
        root.eventMode = 'static';
        root.hitArea = new Polygon(HEX);
        root.on('pointerover', () => { if (!interactiveRef.current) return; root.cursor = 'pointer'; v.target = 1.08; useGame.getState().hover(t.id); });
        root.on('pointerout', () => {
          if (!interactiveRef.current) return;
          v.target = 1;
          if (useGame.getState().hoveredId === t.id) useGame.getState().hover(null);
        });
        root.on('pointertap', () => {
          if (!interactiveRef.current || drag.moved) return;
          useGame.getState().select(t.id);
          sfx.tick();
        });
        views[t.id] = v;
        world.addChild(root);
      });

      const lastOwner = new Map<number, string | null>();
      const redraw = (flash: boolean) => {
        const st = useGame.getState();
        const selId = st.selectedId;
        const neighborIds = selId !== null ? new Set(neighbors(selId, st.territories)) : new Set<number>();
        const selTile = selId !== null ? st.territories[selId] : null;

        st.territories.forEach((t) => {
          const v = views[t.id];
          const col = hexToNum(t.ownerColor);
          const sel = selId === t.id;
          const isN = neighborIds.has(t.id);
          // Rival: neighbor tile owned by someone else
          const isRival = isN && !!t.owner && t.owner !== st.me;
          // Claimable: neighbor tile not owned
          const isClaimable = isN && !t.owner;

          v.owned = !!t.owner;
          v.color = col;
          v.isNeighbor = false; // Neighbor highlights disabled
          v.isRival = false;
          v.isClaimable = false;
          v.isSelected = sel;

          // Base hex shape
          v.base.clear();
          v.base.poly(HEX).fill({ color: hexToNum(BIOMES[t.biome].fill) });
          if (t.owner) v.base.poly(HEX).fill({ color: col, alpha: 0.28 });
          v.base.poly(HEX).stroke({
            width: sel ? 3 : 1.5,
            color: sel ? 0x22d3ee : t.owner ? col : 0x2a3350,
            alpha: sel || t.owner ? 1 : 0.8,
          });

          // Glow halo
          v.glow.clear();
          if (t.owner) v.glow.poly(HEX).stroke({ width: 7, color: col, alpha: 0.35 });

          // Hover highlight — cleared for neighbors, only selected tile gets it
          v.highlight.clear();

          // Chog image sprite
          v.icon.clear();
          if (t.owner && t.chogId != null) {
            v.sprite!.visible = false;
            // Draw colored placeholder immediately (owner color circle)
            v.icon.circle(0, 0, S * 0.5).fill({ color: col, alpha: 0.6 });
            v.icon.circle(0, 0, S * 0.5).stroke({ width: 1.5, color: 0xffffff, alpha: 0.3 });

            loadChogTexture(t.chogId).then((tex) => {
              if (!v.sprite) return;
              if (tex && tex !== Texture.WHITE) {
                // Real image loaded — show sprite, hide placeholder
                v.sprite.texture = tex;
                v.sprite.visible = true;
                v.sprite.tint = 0xffffff;
                v.icon.clear();
              }
              // If failed → keep showing the colored placeholder circle
            });
          } else {
            if (v.sprite) v.sprite.visible = false;
          }

          // Action ring (selected tile): red for rival, green for unclaimed+adjacent
          v.actionRing.clear();
          if (sel && selTile) {
            const isSelRival = !!selTile.owner && selTile.owner !== st.me;
            const isSelUnclaimed = !selTile.owner;
            if (isSelRival) {
              v.actionRing.circle(0, 0, S * 0.88).stroke({ width: 2.5, color: 0xf43f5e });
            } else if (isSelUnclaimed) {
              v.actionRing.circle(0, 0, S * 0.88).stroke({ width: 2.5, color: 0x34d399 });
            }
          }

          // Territory name label (updated, visibility handled in ticker by zoom)
          v.label.text = t.name.slice(0, 4).toUpperCase();

          // Flash on ownership change
          if (flash && lastOwner.has(t.id) && lastOwner.get(t.id) !== t.owner) v.flash = 1;
          lastOwner.set(t.id, t.owner);
        });
      };
      redraw(false);
      const unsub = useGame.subscribe((s, p) => {
        if (s.territories !== p.territories || s.selectedId !== p.selectedId) redraw(true);
      });

      // Floating ambient particles
      const palette = [0xa855f7, 0x22d3ee, 0xfb923c];
      const dots = Array.from({ length: 60 }, () => {
        const g = new Graphics();
        g.circle(0, 0, 1 + Math.random() * 1.8).fill({ color: palette[Math.floor(Math.random() * 3)] });
        g.alpha = 0.15 + Math.random() * 0.35;
        g.position.set(Math.random() * app.screen.width, Math.random() * app.screen.height);
        fx.addChild(g);
        return { g, vx: (Math.random() - 0.5) * 0.15, vy: -0.1 - Math.random() * 0.25, ph: Math.random() * 6 };
      });

      const getViewportCenter = () => {
        const w = app.screen.width;
        const h = app.screen.height;
        if (w >= 1024) {
          // Desktop: panel is ~360px on the right, so active center is shifted left
          return { cx: (w - 380) / 2, cy: h / 2, availW: w - 380, availH: h };
        } else {
          // Mobile: panel covers bottom ~50%
          return { cx: w / 2, cy: (h * 0.45) / 2, availW: w, availH: h * 0.45 };
        }
      };

      const fit = () => {
        const { cx, cy, availW, availH } = getViewportCenter();
        const k = Math.min(availW / MAP_W, availH / MAP_H) * (interactive ? 0.9 : 1.1);
        world.scale.set(k);
        world.position.set(cx - (MAP_W * k) / 2, cy - (MAP_H * k) / 2);
        setZoomPct(Math.round(k * 100));
      };
      fit();
      app.renderer.on('resize', fit);

      const zoomAt = (f: number, cx: number, cy: number) => {
        const old = world.scale.x;
        const ns = Math.min(2.6, Math.max(0.35, old * f));
        const k = ns / old;
        world.x = cx - (cx - world.x) * k;
        world.y = cy - (cy - world.y) * k;
        world.scale.set(ns);
        setZoomPct(Math.round(ns * 100));
      };

      /** Smoothly pan camera to center a tile on screen */
      const focus = (id: number) => {
        const t = useGame.getState().territories[id];
        if (!t) return;
        const { x, y } = hexPos(t.q, t.r);
        const k = Math.max(world.scale.x, 1.2);
        const { cx, cy } = getViewportCenter();
        world.scale.set(k);
        world.x = cx - x * k;
        world.y = cy - y * k;
        setZoomPct(Math.round(k * 100));
      };
      api.current = { zoom: (f) => { const { cx, cy } = getViewportCenter(); zoomAt(f, cx, cy); }, reset: fit, focus };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const r = app.canvas.getBoundingClientRect();
        zoomAt(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
      };

      app.canvas.addEventListener('wheel', (e) => { if (!interactiveRef.current) return; onWheel(e); }, { passive: false });
      app.stage.on('pointerdown', (e) => {
        if (!interactiveRef.current) return;
        drag.active = true; drag.moved = false;
        drag.sx = e.global.x; drag.sy = e.global.y; drag.ox = world.x; drag.oy = world.y;
      });
      app.stage.on('pointermove', (e) => {
        if (!interactiveRef.current || !drag.active) return;
        const dx = e.global.x - drag.sx, dy = e.global.y - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
        if (drag.moved) { world.x = drag.ox + dx; world.y = drag.oy + dy; }
      });
      const end = () => { drag.active = false; drag.moved = false; };
      app.stage.on('pointerup', end);
      app.stage.on('pointerupoutside', end);

      // Camera auto-pan on click disabled — causes disorientation
      const unsubFocus = () => {};

      app.ticker.add((tk) => {
        const t = performance.now() / 1000;
        const dt = tk.deltaTime;
        const scale = world.scale.x;

        for (const v of views) {
          let targetScale = v.target;
          let proximityGlow = 0;

          // Proximity auto-zoom effect (ONLY for the landing page background)
          const pointer = app.renderer.events.pointer;
          if (!interactive && pointer && pointer.global.x !== -10000) {
            const localMouse = world.toLocal(pointer.global);
            const dx = localMouse.x - v.root.x;
            const dy = localMouse.y - v.root.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = S * 3.5;
            if (dist < maxDist) {
              const intensity = Math.pow(1 - Math.min(1, dist / maxDist), 2);
              targetScale += intensity * 0.45; // Bulge up to 45% larger
              proximityGlow = intensity * 0.3; // Slight highlight glow
            }
          }

          // Hover scale spring
          v.root.scale.set(v.root.scale.x + (targetScale - v.root.scale.x) * 0.18);
          
          // Apply proximity glow to highlight poly
          if (!v.isSelected) {
            v.highlight.alpha += ((proximityGlow > 0 ? proximityGlow : 0) - v.highlight.alpha) * 0.15;
          }

          // Glow pulsing
          if (v.owned) {
            v.glow.alpha = 0.5 + 0.4 * Math.sin(t * 1.6 + v.phase);
            v.ring.alpha = 0;
          } else if (v.isNeighbor) {
            v.ring.alpha = 0;
            if (v.isRival) {
              // Rival neighbors pulse red glow
              v.glow.alpha = 0.25 + 0.25 * Math.sin(t * 3.5 + v.phase);
            } else if (v.isClaimable) {
              // Claimable neighbors pulse green glow
              v.glow.alpha = 0.3 + 0.3 * Math.sin(t * 2.8 + v.phase);
            } else {
              v.glow.alpha = 0.3 + 0.2 * Math.sin(t * 3 + v.phase);
            }
          } else {
            const p = 0.5 + 0.5 * Math.sin(t * 2 + v.phase);
            v.ring.alpha = 0.12 + 0.3 * p;
            v.ring.scale.set(1 + 0.5 * p);
            v.glow.alpha = 0;
          }

          // Action ring: pulse animation on selected tile
          if (v.isSelected) {
            const pulse = 0.5 + 0.5 * Math.sin(t * 4);
            v.actionRing.alpha = 0.5 + 0.5 * pulse;
            v.actionRing.scale.set(1 + 0.07 * pulse);
          } else {
            v.actionRing.alpha = 0;
            v.actionRing.scale.set(1);
          }

          // Burst flash on ownership change
          if (v.flash > 0) {
            v.flash = Math.max(0, v.flash - dt * 0.025);
            v.burst.tint = v.color;
            v.burst.alpha = v.flash;
            v.burst.scale.set(1 + (1 - v.flash) * 2.4);
          } else v.burst.alpha = 0;

          // Tile labels: show abbreviated name when zoomed in enough
          if (scale > 1.5) {
            const targetAlpha = Math.min(1, (scale - 1.5) / 0.5);
            v.label.alpha = v.label.alpha + (targetAlpha - v.label.alpha) * 0.1;
          } else {
            v.label.alpha = v.label.alpha * 0.85;
            if (v.label.alpha < 0.01) v.label.alpha = 0;
          }
        }

        for (const d of dots) {
          d.g.x += d.vx * dt + Math.sin(t + d.ph) * 0.15;
          d.g.y += d.vy * dt;
          if (d.g.y < -5) { d.g.y = app.screen.height + 5; d.g.x = Math.random() * app.screen.width; }
        }
      });

      teardown = () => {
        unsub();
        unsubFocus();
        app.canvas.removeEventListener('wheel', onWheel);
      };
      setReady(true);
    })();

    return () => {
      disposed = true;
      teardown();
      if (initDone) app.destroy(true, { children: true });
    };
  }, []);

  return (
    <div
      className="relative h-full w-full"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        pos.current = { x: e.clientX - r.left, y: e.clientY - r.top };
        applyTip();
      }}
    >
      <div ref={host} className="absolute inset-0 touch-none" />

            {/* Loading state */}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink/60">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-grape/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-grape animate-spin" />
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-mist">Initializing map</div>
        </div>
      )}

      {/* Zoom controls + zoom % indicator */}
      {interactive && ready && (
        <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
          {[
            { l: '+', f: () => api.current.zoom(1.3) },
            { l: '−', f: () => api.current.zoom(0.77) },
            { l: '⟲', f: () => api.current.reset() },
          ].map((b) => (
            <button key={b.l} onClick={b.f} className="btn-ghost !h-10 !w-10 !p-0 text-lg" aria-label={`map ${b.l}`}>{b.l}</button>
          ))}
          <div className="text-center font-mono text-[10px] text-mist">{zoomPct}%</div>
        </div>
      )}

      {/* Hover tooltip */}
      {interactive && hovered && (
        <div ref={tip} className="panel pointer-events-none absolute left-0 top-0 z-20 w-60 p-3 text-sm">
          <div className="font-display font-bold leading-tight">{hovered.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-mist">
            <span>{BIOME_ICONS[BIOMES[hovered.biome].iconName]}</span>
            <span>{hovered.biome}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: hovered.owner ? hovered.ownerColor : '#22D3EE' }}>
            {hovered.owner && (
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: hovered.ownerColor }}
              />
            )}
            <span>{hovered.owner ? `Held by ${ownerLabel(hovered, me)}` : 'Unclaimed — free real estate'}</span>
          </div>
          <div className="mt-1.5 flex gap-4 font-mono text-xs">
            <span className="text-mint">{tileYield(hovered) || Math.round(100 * BIOMES[hovered.biome].yield)}<span className="text-mist">/day</span></span>
            {hovered.owner && <span className="text-ice">DEF <span className="font-bold">{tileDefense(hovered)}</span></span>}
          </div>
        </div>
      )}

      {/* Minimap: bottom-right corner, 160×100px */}
      {interactive && ready && (
        <div 
          className="absolute z-10 overflow-hidden rounded-lg border border-white/10 shadow-lg bg-[#0B0F19] cursor-pointer transition-transform hover:scale-[1.02] active:scale-95
                     top-[80px] right-3 lg:top-auto lg:bottom-4 lg:right-auto lg:left-4"
          onClick={(e) => {
            const rect = minimapRef.current?.getBoundingClientRect();
            if (!rect) return;
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            const scaleX = 160 / MAP_W;
            const scaleY = 100 / MAP_H;
            const tx = clickX / scaleX;
            const ty = clickY / scaleY;

            let closestId = 0;
            let minDist = Infinity;
            useGame.getState().territories.forEach((t) => {
              const { x, y } = hexPos(t.q, t.r);
              const dist = (x - tx)**2 + (y - ty)**2;
              if (dist < minDist) {
                minDist = dist;
                closestId = t.id;
              }
            });
            api.current.focus(closestId);
          }}
        >
          <canvas
            ref={minimapRef}
            width={160}
            height={100}
            className="block opacity-80 hover:opacity-100 transition-opacity"
            title="Click to pan camera"
          />
          <div className="absolute bottom-1 left-1 font-mono text-[8px] font-bold text-white/50 select-none pointer-events-none">MINIMAP</div>
        </div>
      )}

      {/* Map biome legend: bottom-left */}
      {interactive && ready && (
        <details className="absolute z-10 group top-[190px] right-3 lg:top-auto lg:bottom-4 lg:right-auto lg:left-[11.5rem]">
          <summary className="panel cursor-pointer select-none px-2 py-1 text-xs text-mist list-none flex items-center gap-1">
            <MapIcon className="w-4 h-4" /><span className="hidden sm:inline">Legend</span>
          </summary>
          <div className="panel absolute bottom-8 left-0 w-44 p-2 text-xs space-y-1">
            {Object.entries(BIOMES).map(([biome, info]) => (
              <div key={biome} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: info.fill, border: '1px solid rgba(255,255,255,0.15)' }}
                />
                <span className="text-mist flex items-center gap-1.5">{BIOME_ICONS[info.iconName]} {biome}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
