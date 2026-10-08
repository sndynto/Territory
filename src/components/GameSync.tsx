'use client';

import { useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { useGame } from '@/store/useGame';
import { createWorld, demoChogIds, deriveChog } from '@/lib/game';
import { CHOG_NFT, CHOG_TOKEN, DEMO, erc721Abi } from '@/lib/contracts';

import { supabase } from '@/lib/supabase';
import { colorForAddress, shortAddr } from '@/lib/game';

export function GameSync() {
  const { address, isConnected } = useAccount();
  const isGuest = useGame((s) => s.isGuest);

  useEffect(() => {
    const initWorld = createWorld(Date.now());
    useGame.getState().hydrate(initWorld);

    // Fetch initial state from Supabase
    supabase.from('territories').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        useGame.setState((s) => {
          const newTerr = [...s.territories];
          data.forEach(dbT => {
            const idx = newTerr.findIndex(t => t.id === dbT.id);
            if (idx > -1) {
              newTerr[idx] = {
                ...newTerr[idx],
                owner: dbT.owner || null,
                ownerName: dbT.owner ? shortAddr(dbT.owner) : '',
                ownerColor: dbT.owner ? colorForAddress(dbT.owner) : 'transparent',
                chogId: dbT.chog_id || null,
                lastClaim: dbT.last_claim ? new Date(dbT.last_claim).getTime() : 0,
              };
            }
          });
          return { territories: newTerr };
        });
      }
    });

    // Subscribe to realtime changes
    const sub = supabase.channel('public:territories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'territories' }, (payload) => {
        const dbT = payload.new as any;
        if (!dbT || !dbT.id) return;
        useGame.setState((s) => {
          const newTerr = [...s.territories];
          const idx = newTerr.findIndex(t => t.id === dbT.id);
          if (idx > -1) {
            newTerr[idx] = {
              ...newTerr[idx],
              owner: dbT.owner || null,
              ownerName: dbT.owner ? shortAddr(dbT.owner) : '',
              ownerColor: dbT.owner ? colorForAddress(dbT.owner) : 'transparent',
              chogId: dbT.chog_id || null,
              lastClaim: dbT.last_claim ? new Date(dbT.last_claim).getTime() : 0,
            };
          }
          return { territories: newTerr };
        });
      }).subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);
    
  useEffect(() => {
    // Background Music
    const audio = new Audio('https://upload.wikimedia.org/wikipedia/commons/e/ee/8-bit_Music_Loop.ogg');
    audio.loop = true;
    audio.volume = 0.1;
    
    let isPlaying = false;
    
    const tryPlay = () => {
      if (useGame.getState().soundOn && !isPlaying) {
        audio.play().then(() => { isPlaying = true; }).catch(() => {});
      }
    };

    // Try to play on any user interaction (to bypass autoplay restrictions)
    window.addEventListener('click', tryPlay, { once: true });
    window.addEventListener('keydown', tryPlay, { once: true });

    const unsub = useGame.subscribe((s, prev) => {
      if (s.soundOn !== prev.soundOn) {
        if (s.soundOn) {
          audio.play().then(() => { isPlaying = true; }).catch(() => {});
        } else {
          audio.pause();
          isPlaying = false;
        }
      }
    });

    return () => {
      window.removeEventListener('click', tryPlay);
      window.removeEventListener('keydown', tryPlay);
      unsub();
      audio.pause();
    };
  }, []);

  const { data: bal } = useReadContract({
    address: CHOG_NFT, abi: erc721Abi, functionName: 'balanceOf', args: [address!],
    query: { enabled: !DEMO && !!address },
  });
  const calls = useMemo(
    () =>
      Array.from({ length: Number(bal ?? 0n) }, (_, i) => ({
        address: CHOG_NFT!, abi: erc721Abi, functionName: 'tokenOfOwnerByIndex' as const, args: [address!, BigInt(i)] as const,
      })),
    [bal, address],
  );
  const { data: ids } = useReadContracts({ contracts: calls, query: { enabled: !DEMO && calls.length > 0 } });

  const { data: tokenBal } = useReadContract({
    address: CHOG_TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [address!],
    query: { enabled: !DEMO && !!address, refetchInterval: 15_000 },
  });

  useEffect(() => {
    const g = useGame.getState();
    import('@/lib/game').then(({ fetchChogMeta }) => {
      if (isGuest) {
        const ids = demoChogIds(g.me!);
        g.setChogs(ids.map(deriveChog));
        ids.forEach(id => fetchChogMeta(id));
        return;
      }
      if (!isConnected || !address) return g.disconnect();
      g.connect(address);
      if (DEMO) {
        const ids = demoChogIds(address);
        g.setChogs(ids.map(deriveChog));
        ids.forEach(id => fetchChogMeta(id));
      }
      else if (ids) {
        const validIds = ids.flatMap((r) => (r.status === 'success' ? [Number(r.result)] : []));
        g.setChogs(validIds.map(deriveChog));
        validIds.forEach(id => fetchChogMeta(id));
      }
    });
  }, [address, isConnected, ids, isGuest]);

  useEffect(() => {
    if (!DEMO && tokenBal !== undefined) useGame.getState().setBalance(Math.floor(Number(formatUnits(tokenBal, 18))));
  }, [tokenBal]);

  useEffect(() => {
    if (!DEMO) return;
    const i = setInterval(() => useGame.getState().simulateRaid(), 45_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const handleMeta = () => {
      // Force a shallow re-render across the app so the new real traits are visible
      useGame.setState((s) => ({ ...s }));
    };
    window.addEventListener('chog-meta-loaded', handleMeta);
    return () => window.removeEventListener('chog-meta-loaded', handleMeta);
  }, []);

  return null;
}
